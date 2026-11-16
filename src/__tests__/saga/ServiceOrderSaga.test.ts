import { ServiceOrder } from '../../domain/entities/ServiceOrder';
import { ServiceOrderStatus } from '../../domain/enums/ServiceOrderStatus';
import { CompensationStep, SagaStatus, ServiceOrderSaga } from '../../domain/saga/ServiceOrderSaga';
import { Commands, Events, Exchanges, RoutingKeys } from '../../domain/saga/SagaMessages';

const now = new Date('2026-11-13T12:00:00Z');

function makeOrder(overrides: Partial<ServiceOrder> = {}): ServiceOrder {
  return new ServiceOrder({
    id: 'os-1',
    orderNumber: 'OS-2026-001',
    status: ServiceOrderStatus.RECEBIDA,
    clientId: 'c-1',
    vehicleId: 'v-1',
    services: [{ serviceId: 's-1', serviceName: 'Troca de óleo', price: 150.5 }],
    parts: [{ partId: 'p-1', partName: 'Filtro', quantity: 2, unitPrice: 49.99 }],
    budget: 250.48,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function sagaAt(status: SagaStatus, extra: Partial<ServiceOrderSaga> = {}): ServiceOrderSaga {
  return new ServiceOrderSaga({
    id: 'saga-1',
    serviceOrderId: 'os-1',
    status,
    quoteId: 'q-1',
    paymentId: 'pay-1',
    createdAt: now,
    updatedAt: now,
    ...extra,
  });
}

describe('ServiceOrderSaga.start', () => {
  it('cria a saga aguardando orçamento e comanda GerarOrcamento com itens em centavos', () => {
    const { saga, command } = ServiceOrderSaga.start('saga-1', makeOrder(), { id: 'c-1', email: 'j@e.com' }, now);

    expect(saga).toMatchObject({ id: 'saga-1', serviceOrderId: 'os-1', status: SagaStatus.AGUARDANDO_ORCAMENTO });
    expect(saga.history).toHaveLength(1);
    expect(saga.isTerminal).toBe(false);
    expect(command).toMatchObject({
      type: Commands.GERAR_ORCAMENTO,
      exchange: Exchanges.COMMANDS,
      routingKey: RoutingKeys.BILLING,
    });
    expect(command.payload).toEqual({
      clientId: 'c-1',
      clientEmail: 'j@e.com',
      vehicleId: 'v-1',
      items: [
        { kind: 'SERVICE', refId: 's-1', description: 'Troca de óleo', quantity: 1, unitPriceCents: 15050 },
        { kind: 'PART', refId: 'p-1', description: 'Filtro', quantity: 2, unitPriceCents: 4999 },
      ],
    });
  });

  it('usa valores padrão quando construída sem dados opcionais', () => {
    const saga = new ServiceOrderSaga({ id: 's', serviceOrderId: 'o' });
    expect(saga).toMatchObject({
      status: SagaStatus.AGUARDANDO_ORCAMENTO,
      quoteId: null,
      paymentId: null,
      executionId: null,
      pendingCompensations: [],
      history: [],
    });
  });
});

describe('ServiceOrderSaga — caminho feliz', () => {
  it('percorre orçamento → aprovação → pagamento → execução → conclusão', () => {
    const order = makeOrder();
    const saga = sagaAt(SagaStatus.AGUARDANDO_ORCAMENTO, { quoteId: null, paymentId: null });

    let d = saga.apply(Events.ORCAMENTO_GERADO, { quoteId: 'q-9', totalCents: 25048, expiresAt: '2026-11-16T12:00:00Z' }, order, now);
    expect(d).toEqual({ commands: [], serviceOrderStatus: ServiceOrderStatus.AGUARDANDO_APROVACAO });
    expect(saga.quoteId).toBe('q-9');
    expect(saga.approvalDeadline?.toISOString()).toBe('2026-11-16T12:00:00.000Z');

    d = saga.apply(Events.ORCAMENTO_APROVADO, { quoteId: 'q-9', paymentId: 'pay-9' }, order, now);
    expect(d.serviceOrderStatus).toBe(ServiceOrderStatus.AGUARDANDO_PAGAMENTO);
    expect(saga.paymentId).toBe('pay-9');

    d = saga.apply(Events.PAGAMENTO_CONFIRMADO, { paymentId: 'pay-9' }, order, now);
    expect(d.serviceOrderStatus).toBe(ServiceOrderStatus.EM_FILA);
    expect(d.commands[0]).toMatchObject({
      type: Commands.INICIAR_EXECUCAO,
      routingKey: RoutingKeys.EXECUTION,
      payload: {
        quoteId: 'q-9',
        priority: 'NORMAL',
        services: [{ serviceId: 's-1', description: 'Troca de óleo' }],
        parts: [{ partId: 'p-1', quantity: 2 }],
      },
    });
    expect(saga.status).toBe(SagaStatus.EM_EXECUCAO);

    d = saga.apply(Events.EXECUCAO_INICIADA, { executionId: 'exe-1' }, order, now);
    expect(d).toEqual({ commands: [] });
    expect(saga.executionId).toBe('exe-1');

    expect(saga.apply(Events.DIAGNOSTICO_INICIADO, {}, order, now).serviceOrderStatus).toBe(ServiceOrderStatus.EM_DIAGNOSTICO);
    expect(saga.apply(Events.REPARO_INICIADO, {}, order, now).serviceOrderStatus).toBe(ServiceOrderStatus.EM_EXECUCAO);

    d = saga.apply(Events.EXECUCAO_FINALIZADA, {}, order, now);
    expect(d.serviceOrderStatus).toBe(ServiceOrderStatus.FINALIZADA);
    expect(saga.status).toBe(SagaStatus.CONCLUIDA);
    expect(saga.isTerminal).toBe(true);
    expect(saga.history.map((h) => h.to)).toContain(SagaStatus.CONCLUIDA);
  });

  it('aceita orçamento sem prazo ou com prazo inválido', () => {
    const a = sagaAt(SagaStatus.AGUARDANDO_ORCAMENTO);
    a.apply(Events.ORCAMENTO_GERADO, { quoteId: 'q' }, makeOrder(), now);
    expect(a.approvalDeadline).toBeNull();

    const b = sagaAt(SagaStatus.AGUARDANDO_ORCAMENTO);
    b.apply(Events.ORCAMENTO_GERADO, { expiresAt: 'não é data' }, makeOrder(), now);
    expect(b.approvalDeadline).toBeNull();
    expect(b.quoteId).toBeNull();
  });

  it('mantém ids anteriores quando o evento não os informa', () => {
    const saga = sagaAt(SagaStatus.AGUARDANDO_APROVACAO, { paymentId: null });
    saga.apply(Events.ORCAMENTO_APROVADO, {}, makeOrder(), now);
    expect(saga.paymentId).toBeNull();
    saga.apply(Events.PAGAMENTO_CONFIRMADO, {}, makeOrder(), now);
    expect(saga.paymentId).toBeNull();
    saga.apply(Events.EXECUCAO_INICIADA, {}, makeOrder(), now);
    expect(saga.executionId).toBeNull();
  });
});

describe('ServiceOrderSaga — falhas e compensações', () => {
  it('orçamento recusado cancela a OS sem compensação pendente', () => {
    const saga = sagaAt(SagaStatus.AGUARDANDO_APROVACAO);
    const d = saga.apply(Events.ORCAMENTO_RECUSADO, { reason: 'caro demais' }, makeOrder(), now);
    expect(d).toEqual({ commands: [], serviceOrderStatus: ServiceOrderStatus.CANCELADA });
    expect(saga.status).toBe(SagaStatus.COMPENSADA);
    expect(saga.failureReason).toBe('Orçamento recusado: caro demais');

    const semMotivo = sagaAt(SagaStatus.AGUARDANDO_APROVACAO);
    semMotivo.apply(Events.ORCAMENTO_RECUSADO, {}, makeOrder(), now);
    expect(semMotivo.failureReason).toContain('sem motivo informado');
  });

  it('timeout de aprovação cancela o orçamento e conclui a compensação', () => {
    const saga = sagaAt(SagaStatus.AGUARDANDO_APROVACAO);
    const d = saga.apply(Events.TIMEOUT_APROVACAO, {}, makeOrder(), now);
    expect(d.serviceOrderStatus).toBe(ServiceOrderStatus.CANCELADA);
    expect(d.commands).toEqual([
      expect.objectContaining({ type: Commands.CANCELAR_ORCAMENTO, payload: { quoteId: 'q-1', reason: 'Orçamento expirou sem resposta' } }),
    ]);
    expect(saga.status).toBe(SagaStatus.COMPENSANDO);

    const done = saga.apply(Events.ORCAMENTO_CANCELADO, {}, makeOrder(), now);
    expect(done).toEqual({ commands: [] });
    expect(saga.status).toBe(SagaStatus.COMPENSADA);
  });

  it.each([
    [{ mpStatusDetail: 'cc_rejected_insufficient_amount' }, 'cc_rejected_insufficient_amount'],
    [{ mpStatus: 'rejected' }, 'rejected'],
    [{}, 'sem detalhe'],
  ])('pagamento recusado (%p) cancela o orçamento', (payload, detail) => {
    const saga = sagaAt(SagaStatus.AGUARDANDO_PAGAMENTO);
    const d = saga.apply(Events.PAGAMENTO_RECUSADO, payload, makeOrder(), now);
    expect(d.commands[0].type).toBe(Commands.CANCELAR_ORCAMENTO);
    expect(saga.failureReason).toBe(`Pagamento recusado (${detail})`);
    expect(saga.pendingCompensations).toEqual([CompensationStep.CANCELAR_ORCAMENTO]);
  });

  it.each([
    [Events.EXECUCAO_RECUSADA, { reason: 'ESTOQUE_INSUFICIENTE' }, 'Execução recusada: ESTOQUE_INSUFICIENTE'],
    [Events.EXECUCAO_RECUSADA, {}, 'Execução recusada: motivo não informado'],
    [Events.EXECUCAO_FALHOU, { reason: 'elevador quebrado' }, 'Falha na execução: elevador quebrado'],
    [Events.EXECUCAO_FALHOU, {}, 'Falha na execução: motivo não informado'],
  ])('%s estorna o pagamento e depois cancela o orçamento', (event, payload, reason) => {
    const saga = sagaAt(SagaStatus.EM_EXECUCAO);
    const d = saga.apply(event, payload, makeOrder(), now);
    expect(d.serviceOrderStatus).toBe(ServiceOrderStatus.CANCELADA);
    expect(d.commands).toEqual([
      expect.objectContaining({ type: Commands.ESTORNAR_PAGAMENTO, payload: { paymentId: 'pay-1', reason } }),
    ]);
    expect(saga.pendingCompensations).toEqual([CompensationStep.ESTORNAR_PAGAMENTO, CompensationStep.CANCELAR_ORCAMENTO]);

    const next = saga.apply(Events.PAGAMENTO_ESTORNADO, { mpRefundId: 'r-1' }, makeOrder(), now);
    expect(next.commands).toEqual([expect.objectContaining({ type: Commands.CANCELAR_ORCAMENTO })]);
    expect(saga.status).toBe(SagaStatus.COMPENSANDO);

    saga.apply(Events.ORCAMENTO_CANCELADO, {}, makeOrder(), now);
    expect(saga.status).toBe(SagaStatus.COMPENSADA);
    expect(saga.pendingCompensations).toEqual([]);
  });

  it('ignora confirmação de passo de compensação fora da ordem', () => {
    const saga = sagaAt(SagaStatus.COMPENSANDO, {
      pendingCompensations: [CompensationStep.ESTORNAR_PAGAMENTO, CompensationStep.CANCELAR_ORCAMENTO],
    });
    const d = saga.apply(Events.ORCAMENTO_CANCELADO, {}, makeOrder(), now);
    expect(d.ignored).toBe(true);
    expect(saga.pendingCompensations).toHaveLength(2);
  });

  it('usa motivo genérico se a falha original não foi registrada', () => {
    const saga = sagaAt(SagaStatus.COMPENSANDO, {
      pendingCompensations: [CompensationStep.ESTORNAR_PAGAMENTO, CompensationStep.CANCELAR_ORCAMENTO],
      failureReason: null,
    });
    const d = saga.apply(Events.PAGAMENTO_ESTORNADO, {}, makeOrder(), now);
    expect(d.commands[0].payload).toEqual({ quoteId: 'q-1', reason: 'compensação' });
  });

  it('estorno que falha leva a FALHA_COMPENSACAO', () => {
    const saga = sagaAt(SagaStatus.COMPENSANDO, { pendingCompensations: [CompensationStep.ESTORNAR_PAGAMENTO] });
    saga.apply(Events.ESTORNO_FALHOU, { error: 'MP indisponível' }, makeOrder(), now);
    expect(saga.status).toBe(SagaStatus.FALHA_COMPENSACAO);
    expect(saga.history.at(-1)?.note).toBe('Estorno falhou: MP indisponível');

    const semErro = sagaAt(SagaStatus.COMPENSANDO);
    semErro.apply(Events.ESTORNO_FALHOU, {}, makeOrder(), now);
    expect(semErro.history.at(-1)?.note).toBe('Estorno falhou: erro');
  });
});

describe('ServiceOrderSaga — tolerância a reentregas', () => {
  it.each([
    [SagaStatus.AGUARDANDO_APROVACAO, Events.ORCAMENTO_GERADO],
    [SagaStatus.AGUARDANDO_ORCAMENTO, Events.ORCAMENTO_APROVADO],
    [SagaStatus.CONCLUIDA, Events.PAGAMENTO_CONFIRMADO],
    [SagaStatus.COMPENSADA, Events.EXECUCAO_FINALIZADA],
    [SagaStatus.EM_EXECUCAO, Events.PAGAMENTO_ESTORNADO],
  ])('no estado %s ignora %s sem alterar a saga', (status, event) => {
    const saga = sagaAt(status);
    const before = saga.history.length;
    const d = saga.apply(event, {}, makeOrder(), now);
    expect(d).toMatchObject({ commands: [], ignored: true });
    expect(saga.status).toBe(status);
    expect(saga.history).toHaveLength(before);
  });

  it('ignora eventos desconhecidos', () => {
    const d = sagaAt(SagaStatus.EM_EXECUCAO).apply('billing.Outro', {}, makeOrder(), now);
    expect(d).toEqual({ commands: [], ignored: true, reason: 'Evento desconhecido: billing.Outro' });
  });
});
