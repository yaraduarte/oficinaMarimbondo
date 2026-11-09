import { MessageEnvelope } from '../../domain/saga/SagaMessages';

export interface OutboxRecord {
  id: string;
  exchange: string;
  routingKey: string;
  envelope: MessageEnvelope;
  attempts: number;
}

/** Leitura/atualização do outbox pelo relay. */
export interface IOutboxStore {
  /** Reserva até `limit` mensagens pendentes (seguro com várias réplicas). */
  claimPending(limit: number): Promise<OutboxRecord[]>;
  markPublished(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}

export interface IMessagePublisher {
  publish(exchange: string, routingKey: string, envelope: MessageEnvelope): Promise<void>;
}

export interface RelayLogger {
  error(msg: string, meta?: Record<string, unknown>): void;
}

/**
 * Relay do transactional outbox: publica no RabbitMQ as mensagens gravadas pela Saga.
 * Entrega "pelo menos uma vez": em caso de falha a mensagem volta a PENDING e é reenviada;
 * a duplicidade é absorvida pelos consumidores idempotentes.
 */
export class OutboxRelay {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly store: IOutboxStore,
    private readonly publisher: IMessagePublisher,
    private readonly logger: RelayLogger = console,
    private readonly batchSize = 50,
  ) {}

  /** Publica um lote. Retorna quantas mensagens foram publicadas. */
  async flush(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let published = 0;
    try {
      const batch = await this.store.claimPending(this.batchSize);
      for (const record of batch) {
        try {
          await this.publisher.publish(record.exchange, record.routingKey, record.envelope);
          await this.store.markPublished(record.id);
          published += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error('[OutboxRelay] Falha ao publicar', { id: record.id, type: record.envelope.type, error: message });
          await this.store.markFailed(record.id, message);
        }
      }
    } finally {
      this.running = false;
    }
    return published;
  }

  start(intervalMs = 1000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.flush().catch((err) => this.logger.error('[OutboxRelay] Erro no ciclo', { error: String(err) }));
    }, intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
