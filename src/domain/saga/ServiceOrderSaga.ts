import { ServiceOrder } from '../entities/ServiceOrder';
import { ServiceOrderStatus } from '../enums/ServiceOrderStatus';
import { Commands, Events, Exchanges, RoutingKeys, SagaCommand } from './SagaMessages';

export enum SagaStatus {
  AGUARDANDO_ORCAMENTO = 'AGUARDANDO_ORCAMENTO',
  AGUARDANDO_APROVACAO = 'AGUARDANDO_APROVACAO',
  AGUARDANDO_PAGAMENTO = 'AGUARDANDO_PAGAMENTO',
  EM_EXECUCAO = 'EM_EXECUCAO',
  CONCLUIDA = 'CONCLUIDA',
  COMPENSANDO = 'COMPENSANDO',
  COMPENSADA = 'COMPENSADA',
  FALHA_COMPENSACAO = 'FALHA_COMPENSACAO',
}

/** Passos de compensação, executados na ordem inversa do fluxo. */
export enum CompensationStep {
  ESTORNAR_PAGAMENTO = 'ESTORNAR_PAGAMENTO',
  CANCELAR_ORCAMENTO = 'CANCELAR_ORCAMENTO',
}

export const TERMINAL_SAGA_STATUSES: SagaStatus[] = [
  SagaStatus.CONCLUIDA,
  SagaStatus.COMPENSADA,
  SagaStatus.FALHA_COMPENSACAO,
];

export interface SagaHistoryEntry {
  at: string;
  event: string;
  from: SagaStatus;
  to: SagaStatus;
  note?: string;
}

/** Resultado de aplicar um evento: comandos a publicar e novo status da OS (se mudou). */
export interface SagaDecision {
  commands: SagaCommand[];
  serviceOrderStatus?: ServiceOrderStatus;
  ignored?: boolean;
  reason?: string;
}

type Payload = Record<string, unknown>;

/**
 * Saga orquestrada do ciclo de vida da OS (ADR-005).
 *
 * Máquina de estados pura, sem I/O: recebe eventos e decide os próximos comandos e o
 * status da OS. Persistência, outbox e broker ficam na camada de aplicação/infra.
 */
export class ServiceOrderSaga {
  id: string;
  serviceOrderId: string;
  status: SagaStatus;
  quoteId: string | null;
  paymentId: string | null;
  executionId: string | null;
  pendingCompensations: CompensationStep[];
  failureReason: string | null;
  approvalDeadline: Date | null;
  history: SagaHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<ServiceOrderSaga>) {
    Object.assign(this, data);
    this.status = data.status ?? SagaStatus.AGUARDANDO_ORCAMENTO;
    this.quoteId = data.quoteId ?? null;
    this.paymentId = data.paymentId ?? null;
    this.executionId = data.executionId ?? null;
    this.pendingCompensations = data.pendingCompensations ?? [];
    this.failureReason = data.failureReason ?? null;
    this.approvalDeadline = data.approvalDeadline ?? null;
    this.history = data.history ?? [];
  }

  get isTerminal(): boolean {
    return TERMINAL_SAGA_STATUSES.includes(this.status);
  }

  /** Inicia a saga para uma OS recém-aberta: pede o orçamento ao billing-service. */
  static start(id: string, order: ServiceOrder, client: { id: string; email: string }, now = new Date()) {
    const saga = new ServiceOrderSaga({
      id,
      serviceOrderId: order.id,
      status: SagaStatus.AGUARDANDO_ORCAMENTO,
      createdAt: now,
      updatedAt: now,
    });
    saga.history.push({ at: now.toISOString(), event: 'saga.Iniciada', from: saga.status, to: saga.status });

    const toCents = (v: number) => Math.round(v * 100);
    const command: SagaCommand = {
      type: Commands.GERAR_ORCAMENTO,
      exchange: Exchanges.COMMANDS,
      routingKey: RoutingKeys.BILLING,
      payload: {
        clientId: client.id,
        clientEmail: client.email,
        vehicleId: order.vehicleId,
        items: [
          ...order.services.map((s) => ({
            kind: 'SERVICE',
            refId: s.serviceId,
            description: s.serviceName,
            quantity: 1,
            unitPriceCents: toCents(s.price),
          })),
          ...order.parts.map((p) => ({
            kind: 'PART',
            refId: p.partId,
            description: p.partName,
            quantity: p.quantity,
            unitPriceCents: toCents(p.unitPrice),
          })),
        ],
      },
    };
    return { saga, command };
  }

  /**
   * Aplica um evento recebido. Eventos fora de ordem ou duplicados para o estado atual
   * são ignorados (sem efeito colateral), o que torna o orquestrador tolerante a reentregas.
   */
  apply(eventType: string, payload: Payload, order: ServiceOrder, now = new Date()): SagaDecision {
    switch (eventType) {
      case Events.ORCAMENTO_GERADO:
        return this.onQuoteGenerated(payload, now);
      case Events.ORCAMENTO_APROVADO:
        return this.expect(SagaStatus.AGUARDANDO_APROVACAO, eventType, now, () => {
          this.paymentId = (payload.paymentId as string) ?? null;
          this.transition(SagaStatus.AGUARDANDO_PAGAMENTO, eventType, now);
          return { commands: [], serviceOrderStatus: ServiceOrderStatus.AGUARDANDO_PAGAMENTO };
        });
      case Events.ORCAMENTO_RECUSADO:
        return this.expect(SagaStatus.AGUARDANDO_APROVACAO, eventType, now, () => {
          // Nada a desfazer: o próprio billing já marcou o orçamento como recusado
          this.failureReason = `Orçamento recusado: ${payload.reason ?? 'sem motivo informado'}`;
          this.transition(SagaStatus.COMPENSADA, eventType, now, this.failureReason);
          return { commands: [], serviceOrderStatus: ServiceOrderStatus.CANCELADA };
        });
      case Events.TIMEOUT_APROVACAO:
        return this.expect(SagaStatus.AGUARDANDO_APROVACAO, eventType, now, () =>
          this.compensate([CompensationStep.CANCELAR_ORCAMENTO], 'Orçamento expirou sem resposta', eventType, now),
        );
      case Events.PAGAMENTO_CONFIRMADO:
        return this.expect(SagaStatus.AGUARDANDO_PAGAMENTO, eventType, now, () => {
          this.paymentId = (payload.paymentId as string) ?? this.paymentId;
          this.transition(SagaStatus.EM_EXECUCAO, eventType, now);
          return {
            commands: [this.startExecutionCommand(order)],
            serviceOrderStatus: ServiceOrderStatus.EM_FILA,
          };
        });
      case Events.PAGAMENTO_RECUSADO:
        return this.expect(SagaStatus.AGUARDANDO_PAGAMENTO, eventType, now, () =>
          this.compensate(
            [CompensationStep.CANCELAR_ORCAMENTO],
            `Pagamento recusado (${payload.mpStatusDetail ?? payload.mpStatus ?? 'sem detalhe'})`,
            eventType,
            now,
          ),
        );
      case Events.EXECUCAO_INICIADA:
        return this.expect(SagaStatus.EM_EXECUCAO, eventType, now, () => {
          this.executionId = (payload.executionId as string) ?? null;
          this.record(eventType, now, 'Execução na fila');
          return { commands: [] };
        });
      case Events.DIAGNOSTICO_INICIADO:
        return this.expect(SagaStatus.EM_EXECUCAO, eventType, now, () => {
          this.record(eventType, now);
          return { commands: [], serviceOrderStatus: ServiceOrderStatus.EM_DIAGNOSTICO };
        });
      case Events.REPARO_INICIADO:
        return this.expect(SagaStatus.EM_EXECUCAO, eventType, now, () => {
          this.record(eventType, now);
          return { commands: [], serviceOrderStatus: ServiceOrderStatus.EM_EXECUCAO };
        });
      case Events.EXECUCAO_FINALIZADA:
        return this.expect(SagaStatus.EM_EXECUCAO, eventType, now, () => {
          this.transition(SagaStatus.CONCLUIDA, eventType, now);
          return { commands: [], serviceOrderStatus: ServiceOrderStatus.FINALIZADA };
        });
      case Events.EXECUCAO_RECUSADA:
      case Events.EXECUCAO_FALHOU:
        return this.expect(SagaStatus.EM_EXECUCAO, eventType, now, () => {
          const reason =
            eventType === Events.EXECUCAO_RECUSADA
              ? `Execução recusada: ${payload.reason ?? 'motivo não informado'}`
              : `Falha na execução: ${payload.reason ?? 'motivo não informado'}`;
          return this.compensate(
            [CompensationStep.ESTORNAR_PAGAMENTO, CompensationStep.CANCELAR_ORCAMENTO],
            reason,
            eventType,
            now,
          );
        });
      case Events.PAGAMENTO_ESTORNADO:
        return this.onCompensationStepDone(CompensationStep.ESTORNAR_PAGAMENTO, eventType, now);
      case Events.ORCAMENTO_CANCELADO:
        return this.onCompensationStepDone(CompensationStep.CANCELAR_ORCAMENTO, eventType, now);
      case Events.ESTORNO_FALHOU:
        return this.expect(SagaStatus.COMPENSANDO, eventType, now, () => {
          this.transition(SagaStatus.FALHA_COMPENSACAO, eventType, now, `Estorno falhou: ${payload.error ?? 'erro'}`);
          return { commands: [] };
        });
      default:
        return { commands: [], ignored: true, reason: `Evento desconhecido: ${eventType}` };
    }
  }

  // ---------------------------------------------------------------------------

  private onQuoteGenerated(payload: Payload, now: Date): SagaDecision {
    return this.expect(SagaStatus.AGUARDANDO_ORCAMENTO, Events.ORCAMENTO_GERADO, now, () => {
      this.quoteId = (payload.quoteId as string) ?? null;
      const expiresAt = payload.expiresAt ? new Date(payload.expiresAt as string) : null;
      this.approvalDeadline = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null;
      this.transition(SagaStatus.AGUARDANDO_APROVACAO, Events.ORCAMENTO_GERADO, now);
      return { commands: [], serviceOrderStatus: ServiceOrderStatus.AGUARDANDO_APROVACAO };
    });
  }

  private startExecutionCommand(order: ServiceOrder): SagaCommand {
    return {
      type: Commands.INICIAR_EXECUCAO,
      exchange: Exchanges.COMMANDS,
      routingKey: RoutingKeys.EXECUTION,
      payload: {
        quoteId: this.quoteId,
        priority: 'NORMAL',
        services: order.services.map((s) => ({ serviceId: s.serviceId, description: s.serviceName })),
        parts: order.parts.map((p) => ({ partId: p.partId, quantity: p.quantity })),
      },
    };
  }

  /** Entra em compensação e dispara o primeiro passo; a OS é cancelada imediatamente. */
  private compensate(steps: CompensationStep[], reason: string, eventType: string, now: Date): SagaDecision {
    this.failureReason = reason;
    this.pendingCompensations = [...steps];
    this.transition(SagaStatus.COMPENSANDO, eventType, now, reason);
    return { commands: [this.compensationCommand(steps[0], reason)], serviceOrderStatus: ServiceOrderStatus.CANCELADA };
  }

  private onCompensationStepDone(step: CompensationStep, eventType: string, now: Date): SagaDecision {
    return this.expect(SagaStatus.COMPENSANDO, eventType, now, () => {
      if (this.pendingCompensations[0] !== step) {
        return this.ignore(eventType, `Passo ${step} não é o próximo esperado`);
      }
      this.pendingCompensations = this.pendingCompensations.slice(1);
      const next = this.pendingCompensations[0];
      if (!next) {
        this.transition(SagaStatus.COMPENSADA, eventType, now);
        return { commands: [] };
      }
      this.record(eventType, now, `Próximo passo: ${next}`);
      return { commands: [this.compensationCommand(next, this.failureReason ?? 'compensação')] };
    });
  }

  private compensationCommand(step: CompensationStep, reason: string): SagaCommand {
    if (step === CompensationStep.ESTORNAR_PAGAMENTO) {
      return {
        type: Commands.ESTORNAR_PAGAMENTO,
        exchange: Exchanges.COMMANDS,
        routingKey: RoutingKeys.BILLING,
        payload: { paymentId: this.paymentId, reason },
      };
    }
    return {
      type: Commands.CANCELAR_ORCAMENTO,
      exchange: Exchanges.COMMANDS,
      routingKey: RoutingKeys.BILLING,
      payload: { quoteId: this.quoteId, reason },
    };
  }

  private expect(expected: SagaStatus, eventType: string, now: Date, handler: () => SagaDecision): SagaDecision {
    if (this.status !== expected) {
      return this.ignore(eventType, `Evento ${eventType} inesperado no estado ${this.status}`);
    }
    const decision = handler();
    this.updatedAt = now;
    return decision;
  }

  private ignore(_eventType: string, reason: string): SagaDecision {
    return { commands: [], ignored: true, reason };
  }

  private transition(to: SagaStatus, event: string, now: Date, note?: string): void {
    this.history.push({ at: now.toISOString(), event, from: this.status, to, ...(note ? { note } : {}) });
    this.status = to;
  }

  private record(event: string, now: Date, note?: string): void {
    this.history.push({ at: now.toISOString(), event, from: this.status, to: this.status, ...(note ? { note } : {}) });
  }
}
