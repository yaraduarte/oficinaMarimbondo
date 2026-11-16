import { v4 as uuidv4 } from 'uuid';
import { ServiceOrder } from '../../domain/entities/ServiceOrder';
import { IClientRepository } from '../../domain/repositories/IClientRepository';
import { ServiceOrderSaga, SagaDecision } from '../../domain/saga/ServiceOrderSaga';
import { Events, MessageEnvelope, SagaCommand } from '../../domain/saga/SagaMessages';
import { AppError } from '../../shared/errors/AppError';
import { ISagaUnitOfWork, SagaTransactionContext } from './ports';

export const PRODUCER = 'os-service';
export const ENVELOPE_VERSION = 1;

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
}

const silentLogger: Logger = { info: () => undefined, warn: () => undefined };

export interface HandleResult extends Partial<SagaDecision> {
  duplicate?: boolean;
  sagaId?: string;
}

/**
 * Orquestrador da Saga da OS (ADR-005).
 * Carrega a saga, aplica o evento na máquina de estados de domínio e grava, na mesma
 * transação: novo estado da saga, novo status da OS, comandos no outbox e o messageId processado.
 */
export class SagaOrchestrator {
  constructor(
    private readonly uow: ISagaUnitOfWork,
    private readonly clientRepository: IClientRepository,
    private readonly idGenerator: () => string = uuidv4,
    private readonly clock: () => Date = () => new Date(),
    private readonly logger: Logger = silentLogger,
  ) {}

  /** Inicia a saga de uma OS recém-aberta (idempotente: não duplica se já existir). */
  async start(order: ServiceOrder): Promise<ServiceOrderSaga> {
    const client = await this.clientRepository.findById(order.clientId);
    if (!client) throw new AppError('Cliente não encontrado para iniciar a saga', 404);

    return this.uow.run(async (ctx) => {
      const existing = await ctx.sagas.findByServiceOrderId(order.id);
      if (existing) return existing;

      const now = this.clock();
      const { saga, command } = ServiceOrderSaga.start(this.idGenerator(), order, client, now);
      await ctx.sagas.save(saga);
      await this.enqueue(ctx, saga, [command], null, now);
      this.logger.info('Saga iniciada', { sagaId: saga.id, osId: order.id });
      return saga;
    });
  }

  /** Processa um evento vindo do broker. */
  async handle(envelope: MessageEnvelope): Promise<HandleResult> {
    return this.uow.run(async (ctx) => {
      if (await ctx.inbox.has(envelope.messageId)) {
        this.logger.info('Mensagem duplicada ignorada', { messageId: envelope.messageId, type: envelope.type });
        return { duplicate: true, commands: [] };
      }

      const saga =
        (envelope.sagaId ? await ctx.sagas.findById(envelope.sagaId) : null) ??
        (envelope.osId ? await ctx.sagas.findByServiceOrderId(envelope.osId) : null);

      if (!saga) {
        this.logger.warn('Evento sem saga correspondente', { messageId: envelope.messageId, sagaId: envelope.sagaId });
        await ctx.inbox.mark(envelope.messageId, envelope.type);
        return { ignored: true, reason: 'Saga não encontrada', commands: [] };
      }

      const result = await this.applyEvent(ctx, saga, envelope.type, envelope.payload, envelope.messageId);
      await ctx.inbox.mark(envelope.messageId, envelope.type);
      return result;
    });
  }

  /** Dispara a compensação das sagas cujo orçamento expirou sem resposta. */
  async checkApprovalTimeouts(): Promise<number> {
    const now = this.clock();
    const expired = await this.uow.run((ctx) => ctx.sagas.findExpiredAwaitingApproval(now));
    let count = 0;
    for (const candidate of expired) {
      const handled = await this.uow.run(async (ctx) => {
        const saga = await ctx.sagas.findById(candidate.id);
        if (!saga) return false;
        const result = await this.applyEvent(ctx, saga, Events.TIMEOUT_APROVACAO, {}, null);
        return !result.ignored;
      });
      if (handled) count += 1;
    }
    return count;
  }

  async getByServiceOrder(serviceOrderId: string): Promise<ServiceOrderSaga> {
    const saga = await this.uow.run((ctx) => ctx.sagas.findByServiceOrderId(serviceOrderId));
    if (!saga) throw new AppError('Saga não encontrada para esta OS', 404);
    return saga;
  }

  // ---------------------------------------------------------------------------

  private async applyEvent(
    ctx: SagaTransactionContext,
    saga: ServiceOrderSaga,
    type: string,
    payload: Record<string, unknown>,
    causationId: string | null,
  ): Promise<HandleResult> {
    const order = await ctx.orders.findById(saga.serviceOrderId);
    if (!order) {
      this.logger.warn('OS da saga não encontrada', { sagaId: saga.id, osId: saga.serviceOrderId });
      return { ignored: true, reason: 'OS não encontrada', commands: [], sagaId: saga.id };
    }

    const now = this.clock();
    const decision = saga.apply(type, payload, order, now);
    if (decision.ignored) {
      this.logger.warn('Evento ignorado pela saga', { sagaId: saga.id, type, reason: decision.reason });
      return { ...decision, sagaId: saga.id };
    }

    if (decision.serviceOrderStatus && decision.serviceOrderStatus !== order.status) {
      if (!order.canTransitionTo(decision.serviceOrderStatus)) {
        this.logger.warn('Transição de OS fora do fluxo padrão aplicada pela saga', {
          osId: order.id,
          from: order.status,
          to: decision.serviceOrderStatus,
        });
      }
      order.status = decision.serviceOrderStatus;
      order.updatedAt = now;
      await ctx.orders.update(order);
    }

    await ctx.sagas.save(saga);
    await this.enqueue(ctx, saga, decision.commands, causationId, now);
    this.logger.info('Evento aplicado', { sagaId: saga.id, type, sagaStatus: saga.status, osStatus: order.status });
    return { ...decision, sagaId: saga.id };
  }

  private async enqueue(
    ctx: SagaTransactionContext,
    saga: ServiceOrderSaga,
    commands: SagaCommand[],
    causationId: string | null,
    now: Date,
  ): Promise<void> {
    for (const command of commands) {
      const envelope: MessageEnvelope = {
        messageId: this.idGenerator(),
        type: command.type,
        version: ENVELOPE_VERSION,
        sagaId: saga.id,
        correlationId: saga.id,
        causationId,
        osId: saga.serviceOrderId,
        occurredAt: now.toISOString(),
        producer: PRODUCER,
        payload: command.payload,
      };
      await ctx.outbox.enqueue({ exchange: command.exchange, routingKey: command.routingKey, envelope });
    }
  }
}
