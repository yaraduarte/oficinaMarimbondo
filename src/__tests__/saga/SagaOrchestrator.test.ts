import { SagaOrchestrator } from '../../application/saga/SagaOrchestrator';
import { ServiceOrder } from '../../domain/entities/ServiceOrder';
import { Client } from '../../domain/entities/Client';
import { ServiceOrderStatus } from '../../domain/enums/ServiceOrderStatus';
import { SagaStatus, ServiceOrderSaga } from '../../domain/saga/ServiceOrderSaga';
import { Commands, Events, MessageEnvelope } from '../../domain/saga/SagaMessages';
import { db, outbox, resetDb, InMemoryClientRepository, InMemorySagaUnitOfWork } from '../support/inMemoryRepositories';

const t0 = new Date('2026-11-13T12:00:00Z');
let clock = t0;
let seq = 0;

function makeOrchestrator(logger = { info: jest.fn(), warn: jest.fn() }) {
  return {
    logger,
    orchestrator: new SagaOrchestrator(
      new InMemorySagaUnitOfWork(),
      new InMemoryClientRepository(),
      () => `id-${++seq}`,
      () => clock,
      logger,
    ),
  };
}

function seedOrder(status = ServiceOrderStatus.RECEBIDA): ServiceOrder {
  db.clients.set('c-1', new Client({ id: 'c-1', name: 'João', email: 'j@e.com', cpfCnpj: '11144477735', phone: '1' }));
  const order = new ServiceOrder({
    id: 'os-1',
    orderNumber: 'OS-2026-001',
    status,
    clientId: 'c-1',
    vehicleId: 'v-1',
    services: [{ serviceId: 's-1', serviceName: 'Óleo', price: 100 }],
    parts: [],
    budget: 100,
    createdAt: t0,
    updatedAt: t0,
  });
  db.orders.set(order.id, order);
  return order;
}

function event(type: string, payload: Record<string, unknown> = {}, sagaId = 'id-1', messageId = `m-${++seq}`): MessageEnvelope {
  return {
    messageId,
    type,
    version: 1,
    sagaId,
    correlationId: sagaId,
    causationId: null,
    osId: 'os-1',
    occurredAt: clock.toISOString(),
    producer: 'billing-service',
    payload,
  };
}

beforeEach(() => {
  resetDb();
  clock = t0;
  seq = 0;
});

describe('SagaOrchestrator.start', () => {
  it('cria a saga e grava o comando GerarOrcamento no outbox com envelope completo', async () => {
    const { orchestrator, logger } = makeOrchestrator();
    const saga = await orchestrator.start(seedOrder());

    expect(saga.status).toBe(SagaStatus.AGUARDANDO_ORCAMENTO);
    expect(db.sagas.get('id-1')).toBeDefined();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      exchange: 'oficina.commands',
      routingKey: 'billing',
      envelope: {
        messageId: 'id-2',
        type: Commands.GERAR_ORCAMENTO,
        version: 1,
        sagaId: 'id-1',
        correlationId: 'id-1',
        causationId: null,
        osId: 'os-1',
        producer: 'os-service',
        occurredAt: t0.toISOString(),
      },
    });
    expect(logger.info).toHaveBeenCalledWith('Saga iniciada', { sagaId: 'id-1', osId: 'os-1' });
  });

  it('é idempotente: não cria segunda saga para a mesma OS', async () => {
    const { orchestrator } = makeOrchestrator();
    const order = seedOrder();
    const first = await orchestrator.start(order);
    const second = await orchestrator.start(order);
    expect(second.id).toBe(first.id);
    expect(db.sagas.size).toBe(1);
    expect(outbox).toHaveLength(1);
  });

  it('falha com 404 se o cliente da OS não existe', async () => {
    const { orchestrator } = makeOrchestrator();
    const order = seedOrder();
    db.clients.clear();
    await expect(orchestrator.start(order)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('SagaOrchestrator.handle', () => {
  it('aplica o evento, atualiza a OS e encadeia comandos com causationId', async () => {
    const { orchestrator } = makeOrchestrator();
    await orchestrator.start(seedOrder());

    await orchestrator.handle(event(Events.ORCAMENTO_GERADO, { quoteId: 'q-1' }));
    expect(db.orders.get('os-1')?.status).toBe(ServiceOrderStatus.AGUARDANDO_APROVACAO);

    await orchestrator.handle(event(Events.ORCAMENTO_APROVADO, { paymentId: 'pay-1' }));
    const result = await orchestrator.handle(event(Events.PAGAMENTO_CONFIRMADO, {}, 'id-1', 'msg-pago'));

    expect(result.sagaId).toBe('id-1');
    expect(db.orders.get('os-1')?.status).toBe(ServiceOrderStatus.EM_FILA);
    expect(db.sagas.get('id-1')?.status).toBe(SagaStatus.EM_EXECUCAO);
    const iniciar = outbox.find((m) => m.envelope.type === Commands.INICIAR_EXECUCAO);
    expect(iniciar?.envelope.causationId).toBe('msg-pago');
    expect(db.processed.has('msg-pago')).toBe(true);
  });

  it('ignora mensagem duplicada (mesmo messageId) sem reprocessar', async () => {
    const { orchestrator } = makeOrchestrator();
    await orchestrator.start(seedOrder());
    const msg = event(Events.ORCAMENTO_GERADO, { quoteId: 'q-1' }, 'id-1', 'dup-1');

    await orchestrator.handle(msg);
    const historyLength = db.sagas.get('id-1')!.history.length;
    const again = await orchestrator.handle(msg);

    expect(again).toEqual({ duplicate: true, commands: [] });
    expect(db.sagas.get('id-1')!.history).toHaveLength(historyLength);
  });

  it('localiza a saga pelo osId quando o sagaId não vem no envelope', async () => {
    const { orchestrator } = makeOrchestrator();
    await orchestrator.start(seedOrder());
    const result = await orchestrator.handle({ ...event(Events.ORCAMENTO_GERADO, { quoteId: 'q' }), sagaId: '' });
    expect(result.ignored).toBeUndefined();
    expect(db.sagas.get('id-1')?.status).toBe(SagaStatus.AGUARDANDO_APROVACAO);
  });

  it('marca como processado e ignora evento sem saga correspondente', async () => {
    const { orchestrator, logger } = makeOrchestrator();
    const result = await orchestrator.handle({ ...event(Events.ORCAMENTO_GERADO, {}, 'nao-existe', 'orfa'), osId: '' });
    expect(result).toMatchObject({ ignored: true, reason: 'Saga não encontrada' });
    expect(db.processed.has('orfa')).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('ignora evento fora de ordem sem gravar comandos', async () => {
    const { orchestrator } = makeOrchestrator();
    await orchestrator.start(seedOrder());
    const result = await orchestrator.handle(event(Events.EXECUCAO_FINALIZADA));
    expect(result.ignored).toBe(true);
    expect(outbox).toHaveLength(1);
    expect(db.orders.get('os-1')?.status).toBe(ServiceOrderStatus.RECEBIDA);
  });

  it('ignora quando a OS da saga não existe mais', async () => {
    const { orchestrator } = makeOrchestrator();
    await orchestrator.start(seedOrder());
    db.orders.clear();
    const result = await orchestrator.handle(event(Events.ORCAMENTO_GERADO));
    expect(result).toMatchObject({ ignored: true, reason: 'OS não encontrada' });
  });

  it('aplica cancelamento mesmo fora do fluxo padrão de transições e registra alerta', async () => {
    const { orchestrator, logger } = makeOrchestrator();
    await orchestrator.start(seedOrder());
    db.sagas.set('id-1', new ServiceOrderSaga({ ...db.sagas.get('id-1')!, status: SagaStatus.AGUARDANDO_PAGAMENTO }));
    db.orders.get('os-1')!.status = ServiceOrderStatus.FINALIZADA;

    await orchestrator.handle(event(Events.PAGAMENTO_RECUSADO));

    expect(db.orders.get('os-1')?.status).toBe(ServiceOrderStatus.CANCELADA);
    expect(logger.warn).toHaveBeenCalledWith(
      'Transição de OS fora do fluxo padrão aplicada pela saga',
      expect.objectContaining({ from: ServiceOrderStatus.FINALIZADA, to: ServiceOrderStatus.CANCELADA }),
    );
  });

  it('não grava nada se a transação falhar (rollback)', async () => {
    const uow = new InMemorySagaUnitOfWork();
    const orchestrator = new SagaOrchestrator(uow, new InMemoryClientRepository(), () => `id-${++seq}`, () => clock);
    await orchestrator.start(seedOrder());
    const originalRun = uow.run.bind(uow);
    jest.spyOn(uow, 'run').mockImplementationOnce((work) =>
      originalRun(async (ctx) => {
        ctx.outbox.enqueue = async () => {
          throw new Error('disco cheio');
        };
        return work(ctx);
      }),
    );

    await expect(orchestrator.handle(event(Events.ORCAMENTO_GERADO))).resolves.toBeDefined();
    // ORCAMENTO_GERADO não gera comandos; força um evento que gera
    db.sagas.get('id-1')!.status = SagaStatus.AGUARDANDO_PAGAMENTO;
    jest.spyOn(uow, 'run').mockImplementationOnce((work) =>
      originalRun(async (ctx) => {
        ctx.outbox.enqueue = async () => {
          throw new Error('disco cheio');
        };
        return work(ctx);
      }),
    );
    await expect(orchestrator.handle(event(Events.PAGAMENTO_CONFIRMADO, {}, 'id-1', 'falha-1'))).rejects.toThrow('disco cheio');
    expect(db.processed.has('falha-1')).toBe(false);
    expect(db.sagas.get('id-1')?.status).toBe(SagaStatus.AGUARDANDO_PAGAMENTO);
  });
});

describe('SagaOrchestrator.checkApprovalTimeouts', () => {
  it('compensa apenas sagas com prazo vencido', async () => {
    const { orchestrator } = makeOrchestrator();
    await orchestrator.start(seedOrder());
    await orchestrator.handle(event(Events.ORCAMENTO_GERADO, { quoteId: 'q-1', expiresAt: '2026-11-14T12:00:00Z' }));

    expect(await orchestrator.checkApprovalTimeouts()).toBe(0);

    clock = new Date('2026-11-15T00:00:00Z');
    expect(await orchestrator.checkApprovalTimeouts()).toBe(1);
    expect(db.sagas.get('id-1')?.status).toBe(SagaStatus.COMPENSANDO);
    expect(db.orders.get('os-1')?.status).toBe(ServiceOrderStatus.CANCELADA);
    expect(outbox.at(-1)?.envelope.type).toBe(Commands.CANCELAR_ORCAMENTO);

    expect(await orchestrator.checkApprovalTimeouts()).toBe(0);
  });

  it('não conta sagas que sumiram entre a busca e o processamento', async () => {
    const uow = new InMemorySagaUnitOfWork();
    const orchestrator = new SagaOrchestrator(uow, new InMemoryClientRepository());
    const ghost = new ServiceOrderSaga({ id: 'ghost', serviceOrderId: 'x', status: SagaStatus.AGUARDANDO_APROVACAO });
    const originalRun = uow.run.bind(uow);
    jest.spyOn(uow, 'run').mockImplementationOnce((work) =>
      originalRun(async (ctx) => work({ ...ctx, sagas: { ...ctx.sagas, findExpiredAwaitingApproval: async () => [ghost] } })),
    );
    expect(await orchestrator.checkApprovalTimeouts()).toBe(0);
  });
});

describe('SagaOrchestrator.getByServiceOrder', () => {
  it('retorna a saga ou 404', async () => {
    const { orchestrator } = makeOrchestrator();
    await expect(orchestrator.getByServiceOrder('os-1')).rejects.toMatchObject({ statusCode: 404 });
    await orchestrator.start(seedOrder());
    await expect(orchestrator.getByServiceOrder('os-1')).resolves.toMatchObject({ id: 'id-1' });
  });

  it('funciona com logger e gerador padrão', async () => {
    const orchestrator = new SagaOrchestrator(new InMemorySagaUnitOfWork(), new InMemoryClientRepository());
    const saga = await orchestrator.start(seedOrder());
    expect(saga.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
