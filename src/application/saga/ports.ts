import { ServiceOrderSaga } from '../../domain/saga/ServiceOrderSaga';
import { MessageEnvelope } from '../../domain/saga/SagaMessages';
import { IServiceOrderRepository } from '../../domain/repositories/IServiceOrderRepository';

export interface ISagaRepository {
  findById(id: string): Promise<ServiceOrderSaga | null>;
  findByServiceOrderId(serviceOrderId: string): Promise<ServiceOrderSaga | null>;
  /** Sagas aguardando aprovação cujo prazo do orçamento já venceu. */
  findExpiredAwaitingApproval(now: Date): Promise<ServiceOrderSaga[]>;
  save(saga: ServiceOrderSaga): Promise<ServiceOrderSaga>;
}

/** Mensagem a ser publicada pelo relay (transactional outbox). */
export interface OutgoingMessage {
  exchange: string;
  routingKey: string;
  envelope: MessageEnvelope;
}

export interface IOutboxWriter {
  enqueue(message: OutgoingMessage): Promise<void>;
}

/** Registro de mensagens já processadas (idempotência do consumidor). */
export interface IProcessedMessageStore {
  has(messageId: string): Promise<boolean>;
  mark(messageId: string, type: string): Promise<void>;
}

/** Repositórios que participam da mesma transação de banco. */
export interface SagaTransactionContext {
  sagas: ISagaRepository;
  orders: IServiceOrderRepository;
  outbox: IOutboxWriter;
  inbox: IProcessedMessageStore;
}

/**
 * Unidade de trabalho: estado da saga, status da OS, mensagens de saída e marcação de
 * idempotência são gravados atomicamente (ou nada é gravado).
 */
export interface ISagaUnitOfWork {
  run<T>(work: (ctx: SagaTransactionContext) => Promise<T>): Promise<T>;
}
