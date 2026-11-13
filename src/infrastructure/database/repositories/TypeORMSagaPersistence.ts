import { DataSource, EntityManager, LessThanOrEqual, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SagaInstanceEntity } from '../entities/SagaInstanceEntity';
import { OutboxMessageEntity } from '../entities/OutboxMessageEntity';
import { ProcessedMessageEntity } from '../entities/ProcessedMessageEntity';
import { ServiceOrderSaga, SagaStatus } from '../../../domain/saga/ServiceOrderSaga';
import {
  IOutboxWriter,
  IProcessedMessageStore,
  ISagaRepository,
  ISagaUnitOfWork,
  OutgoingMessage,
  SagaTransactionContext,
} from '../../../application/saga/ports';
import { TypeORMServiceOrderRepository } from './TypeORMServiceOrderRepository';

type Source = DataSource | EntityManager;

function toDomain(e: SagaInstanceEntity): ServiceOrderSaga {
  return new ServiceOrderSaga({
    id: e.id,
    serviceOrderId: e.serviceOrderId,
    status: e.status,
    quoteId: e.quoteId,
    paymentId: e.paymentId,
    executionId: e.executionId,
    pendingCompensations: e.pendingCompensations ?? [],
    failureReason: e.failureReason,
    approvalDeadline: e.approvalDeadline,
    history: e.history ?? [],
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  });
}

export class TypeORMSagaRepository implements ISagaRepository {
  private readonly repo: Repository<SagaInstanceEntity>;

  constructor(source: Source) {
    this.repo = source.getRepository(SagaInstanceEntity);
  }

  async findById(id: string) {
    const e = await this.repo.findOne({ where: { id } });
    return e ? toDomain(e) : null;
  }

  async findByServiceOrderId(serviceOrderId: string) {
    const e = await this.repo.findOne({ where: { serviceOrderId } });
    return e ? toDomain(e) : null;
  }

  async findExpiredAwaitingApproval(now: Date) {
    const list = await this.repo.find({
      where: { status: SagaStatus.AGUARDANDO_APROVACAO, approvalDeadline: LessThanOrEqual(now) },
      take: 100,
    });
    return list.map(toDomain);
  }

  async save(saga: ServiceOrderSaga) {
    const entity = new SagaInstanceEntity();
    Object.assign(entity, {
      id: saga.id,
      serviceOrderId: saga.serviceOrderId,
      status: saga.status,
      quoteId: saga.quoteId,
      paymentId: saga.paymentId,
      executionId: saga.executionId,
      pendingCompensations: saga.pendingCompensations,
      failureReason: saga.failureReason,
      approvalDeadline: saga.approvalDeadline,
      history: saga.history,
    });
    await this.repo.save(entity);
    return saga;
  }
}

export class TypeORMOutboxWriter implements IOutboxWriter {
  private readonly repo: Repository<OutboxMessageEntity>;

  constructor(source: Source) {
    this.repo = source.getRepository(OutboxMessageEntity);
  }

  async enqueue(message: OutgoingMessage) {
    const entity = this.repo.create();
    Object.assign(entity, {
      id: uuidv4(),
      exchange: message.exchange,
      routingKey: message.routingKey,
      type: message.envelope.type,
      envelope: message.envelope,
      status: 'PENDING',
      attempts: 0,
    });
    await this.repo.save(entity);
  }
}

export class TypeORMProcessedMessageStore implements IProcessedMessageStore {
  private readonly repo: Repository<ProcessedMessageEntity>;

  constructor(source: Source) {
    this.repo = source.getRepository(ProcessedMessageEntity);
  }

  async has(messageId: string) {
    return (await this.repo.count({ where: { messageId } })) > 0;
  }

  async mark(messageId: string, type: string) {
    await this.repo.insert({ messageId, type });
  }
}

/** Unidade de trabalho sobre uma transação do PostgreSQL. */
export class TypeORMSagaUnitOfWork implements ISagaUnitOfWork {
  constructor(private readonly dataSource: DataSource) {}

  run<T>(work: (ctx: SagaTransactionContext) => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) =>
      work({
        sagas: new TypeORMSagaRepository(manager),
        orders: new TypeORMServiceOrderRepository(manager),
        outbox: new TypeORMOutboxWriter(manager),
        inbox: new TypeORMProcessedMessageStore(manager),
      }),
    );
  }
}
