import { DataSource, EntityManager } from 'typeorm';
import {
  TypeORMSagaRepository,
  TypeORMOutboxWriter,
  TypeORMProcessedMessageStore,
  TypeORMSagaUnitOfWork,
} from '../../infrastructure/database/repositories/TypeORMSagaPersistence';
import { SagaInstanceEntity } from '../../infrastructure/database/entities/SagaInstanceEntity';
import { OutboxMessageEntity } from '../../infrastructure/database/entities/OutboxMessageEntity';
import { ProcessedMessageEntity } from '../../infrastructure/database/entities/ProcessedMessageEntity';
import { CompensationStep, SagaStatus, ServiceOrderSaga } from '../../domain/saga/ServiceOrderSaga';
import { getSagaOrchestrator } from '../../infrastructure/saga/container';

jest.mock('../../infrastructure/database/data-source', () => ({
  AppDataSource: { getRepository: jest.fn(() => ({})) },
}));

const now = new Date('2026-11-13T12:00:00Z');

function repoMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(async (e: unknown) => e),
    insert: jest.fn(),
    count: jest.fn(),
    create: jest.fn(() => new OutboxMessageEntity()),
  };
}

function sourceWith(map: Map<unknown, ReturnType<typeof repoMock>>) {
  return { getRepository: jest.fn((entity: unknown) => map.get(entity)) } as unknown as EntityManager;
}

const entity: Partial<SagaInstanceEntity> = {
  id: 's-1',
  serviceOrderId: 'os-1',
  status: SagaStatus.COMPENSANDO,
  quoteId: 'q-1',
  paymentId: 'p-1',
  executionId: null,
  pendingCompensations: [CompensationStep.CANCELAR_ORCAMENTO],
  failureReason: 'x',
  approvalDeadline: null,
  history: [],
  createdAt: now,
  updatedAt: now,
};

describe('TypeORMSagaRepository', () => {
  it('busca por id, OS e expiradas, mapeando para o domínio', async () => {
    const repo = repoMock();
    repo.findOne.mockResolvedValueOnce(entity).mockResolvedValueOnce({ ...entity, pendingCompensations: null, history: null }).mockResolvedValue(null);
    repo.find.mockResolvedValue([entity]);
    const r = new TypeORMSagaRepository(sourceWith(new Map([[SagaInstanceEntity, repo]])));

    const byId = await r.findById('s-1');
    expect(byId).toBeInstanceOf(ServiceOrderSaga);
    expect(byId?.pendingCompensations).toEqual([CompensationStep.CANCELAR_ORCAMENTO]);
    const byOs = await r.findByServiceOrderId('os-1');
    expect(byOs?.history).toEqual([]);
    expect(await r.findById('x')).toBeNull();
    expect(await r.findByServiceOrderId('x')).toBeNull();

    expect(await r.findExpiredAwaitingApproval(now)).toHaveLength(1);
    expect(repo.find.mock.calls[0][0]).toMatchObject({ where: { status: SagaStatus.AGUARDANDO_APROVACAO }, take: 100 });
  });

  it('salva todos os campos da saga', async () => {
    const repo = repoMock();
    const r = new TypeORMSagaRepository(sourceWith(new Map([[SagaInstanceEntity, repo]])));
    const saga = new ServiceOrderSaga(entity);
    expect(await r.save(saga)).toBe(saga);
    expect(repo.save.mock.calls[0][0]).toMatchObject({ id: 's-1', status: SagaStatus.COMPENSANDO, quoteId: 'q-1', failureReason: 'x' });
  });
});

describe('TypeORMOutboxWriter / TypeORMProcessedMessageStore', () => {
  it('grava mensagem pendente no outbox', async () => {
    const repo = repoMock();
    const w = new TypeORMOutboxWriter(sourceWith(new Map([[OutboxMessageEntity, repo]])));
    await w.enqueue({
      exchange: 'oficina.commands',
      routingKey: 'billing',
      envelope: { messageId: 'm', type: 'billing.GerarOrcamento' } as never,
    });
    expect(repo.save.mock.calls[0][0]).toMatchObject({ exchange: 'oficina.commands', routingKey: 'billing', type: 'billing.GerarOrcamento', status: 'PENDING', attempts: 0 });
  });

  it('consulta e marca mensagens processadas', async () => {
    const repo = repoMock();
    repo.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const s = new TypeORMProcessedMessageStore(sourceWith(new Map([[ProcessedMessageEntity, repo]])));
    expect(await s.has('m')).toBe(true);
    expect(await s.has('n')).toBe(false);
    await s.mark('m', 'billing.X');
    expect(repo.insert).toHaveBeenCalledWith({ messageId: 'm', type: 'billing.X' });
  });
});

describe('TypeORMSagaUnitOfWork', () => {
  it('executa o trabalho dentro de uma transação com repositórios ligados ao EntityManager', async () => {
    const manager = { getRepository: jest.fn(() => repoMock()) };
    const ds = { transaction: jest.fn((fn: (m: unknown) => unknown) => fn(manager)) } as unknown as DataSource;

    const result = await new TypeORMSagaUnitOfWork(ds).run(async (ctx) => {
      expect(ctx.sagas).toBeInstanceOf(TypeORMSagaRepository);
      expect(ctx.outbox).toBeInstanceOf(TypeORMOutboxWriter);
      expect(ctx.inbox).toBeInstanceOf(TypeORMProcessedMessageStore);
      expect(ctx.orders).toBeDefined();
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(manager.getRepository).toHaveBeenCalledTimes(4);
  });
});

describe('container', () => {
  it('reaproveita a mesma instância do orquestrador', () => {
    expect(getSagaOrchestrator()).toBe(getSagaOrchestrator());
  });
});
