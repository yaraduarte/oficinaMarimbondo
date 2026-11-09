import { MessageEnvelope } from '../../domain/saga/SagaMessages';
import { traceMessage } from '../observability/tracing';
import { MAX_DELIVERY_ATTEMPTS } from './topology';

export const RETRY_HEADER = 'x-retry-count';

/** Mensagem recebida, independente do amqplib (facilita testes). */
export interface IncomingMessage {
  content: Buffer;
  headers: Record<string, unknown>;
  routingKey: string;
}

/** Ações de confirmação sobre a mensagem recebida. */
export interface MessageAcks {
  ack(): void;
  /** Rejeita sem recolocar na fila: vai para a DLQ via dead-letter exchange. */
  deadLetter(): void;
  /** Republica para nova tentativa com headers atualizados (e confirma a original). */
  retry(headers: Record<string, unknown>): Promise<void>;
}

export interface SagaEventHandler {
  handle(envelope: MessageEnvelope): Promise<unknown>;
}

export interface ConsumerLogger {
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

function isEnvelope(value: unknown): value is MessageEnvelope {
  const v = value as Partial<MessageEnvelope>;
  return Boolean(v && typeof v.messageId === 'string' && typeof v.type === 'string' && v.payload);
}

/**
 * Consumidor da fila os.saga.events.
 * - JSON inválido / envelope malformado → DLQ direto (não adianta tentar de novo)
 * - erro ao processar → até MAX_DELIVERY_ATTEMPTS tentativas, depois DLQ
 * - idempotência garantida pelo orquestrador (inbox processed_messages)
 */
export class SagaEventConsumer {
  constructor(
    private readonly handler: SagaEventHandler,
    private readonly logger: ConsumerLogger = console,
  ) {}

  async onMessage(message: IncomingMessage, acks: MessageAcks): Promise<void> {
    let envelope: unknown;
    try {
      envelope = JSON.parse(message.content.toString('utf8'));
    } catch {
      this.logger.error('[SagaConsumer] Mensagem com JSON inválido enviada para a DLQ', { routingKey: message.routingKey });
      acks.deadLetter();
      return;
    }

    if (!isEnvelope(envelope)) {
      this.logger.error('[SagaConsumer] Envelope malformado enviado para a DLQ', { routingKey: message.routingKey });
      acks.deadLetter();
      return;
    }

    const attempt = Number(message.headers[RETRY_HEADER] ?? 0);
    try {
      await traceMessage(
        `Saga/${envelope.type}`,
        message.headers,
        { sagaId: envelope.sagaId, osId: envelope.osId, messageId: envelope.messageId },
        () => this.handler.handle(envelope as MessageEnvelope),
      );
      acks.ack();
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      if (attempt + 1 >= MAX_DELIVERY_ATTEMPTS) {
        this.logger.error('[SagaConsumer] Tentativas esgotadas, mensagem enviada para a DLQ', {
          messageId: envelope.messageId,
          type: envelope.type,
          error,
        });
        acks.deadLetter();
        return;
      }
      this.logger.warn('[SagaConsumer] Falha ao processar, nova tentativa agendada', {
        messageId: envelope.messageId,
        attempt: attempt + 1,
        error,
      });
      await acks.retry({ ...message.headers, [RETRY_HEADER]: attempt + 1 });
    }
  }
}
