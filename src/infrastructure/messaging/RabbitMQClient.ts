import amqp from 'amqplib';
import { MessageEnvelope } from '../../domain/saga/SagaMessages';
import { outgoingTraceHeaders } from '../observability/tracing';
import { IMessagePublisher } from './OutboxRelay';
import { IncomingMessage, MessageAcks } from './SagaEventConsumer';
import { assertSagaTopology } from './topology';

type Connector = (url: string) => Promise<amqp.ChannelModel>;

export interface RabbitLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string, err?: unknown): void;
}

/**
 * Conexão com o RabbitMQ: canal com publisher confirms, topologia da Saga,
 * publicação persistente e consumo com prefetch.
 */
export class RabbitMQClient implements IMessagePublisher {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.ConfirmChannel | null = null;

  constructor(
    private readonly url: string,
    private readonly connector: Connector = (u) => amqp.connect(u),
    private readonly logger: RabbitLogger = console,
  ) {}

  async connect(maxAttempts = 10, delayMs = 3000): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        this.connection = await this.connector(this.url);
        this.channel = await this.connection.createConfirmChannel();
        await assertSagaTopology(this.channel);
        this.connection.on('error', (err) => this.logger.error('[RabbitMQ] Erro na conexão', err));
        this.connection.on('close', () => this.logger.warn('[RabbitMQ] Conexão encerrada'));
        this.logger.info('[RabbitMQ] Conectado e topologia declarada');
        return;
      } catch (err) {
        if (attempt >= maxAttempts) throw err;
        this.logger.warn(`[RabbitMQ] Tentativa ${attempt}/${maxAttempts} falhou, nova tentativa em ${delayMs}ms`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  private requireChannel(): amqp.ConfirmChannel {
    if (!this.channel) throw new Error('RabbitMQ não conectado');
    return this.channel;
  }

  async publish(exchange: string, routingKey: string, envelope: MessageEnvelope, extraHeaders: Record<string, unknown> = {}): Promise<void> {
    const channel = this.requireChannel();
    const content = Buffer.from(JSON.stringify(envelope));
    await new Promise<void>((resolve, reject) => {
      channel.publish(
        exchange,
        routingKey,
        content,
        {
          persistent: true,
          contentType: 'application/json',
          messageId: envelope.messageId,
          correlationId: envelope.correlationId,
          type: envelope.type,
          timestamp: Math.floor(Date.now() / 1000),
          headers: { ...outgoingTraceHeaders(), ...extraHeaders },
        },
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }

  async consume(queue: string, onMessage: (msg: IncomingMessage, acks: MessageAcks) => Promise<void>, prefetch = 10): Promise<void> {
    const channel = this.requireChannel();
    await channel.prefetch(prefetch);
    await channel.consume(queue, (raw) => {
      if (!raw) return;
      const incoming: IncomingMessage = {
        content: raw.content,
        headers: (raw.properties.headers ?? {}) as Record<string, unknown>,
        routingKey: raw.fields.routingKey,
      };
      const acks: MessageAcks = {
        ack: () => channel.ack(raw),
        deadLetter: () => channel.nack(raw, false, false),
        retry: async (headers) => {
          const envelope = JSON.parse(raw.content.toString('utf8')) as MessageEnvelope;
          await this.publish(raw.fields.exchange, raw.fields.routingKey, envelope, headers);
          channel.ack(raw);
        },
      };
      onMessage(incoming, acks).catch((err) => {
        this.logger.error('[RabbitMQ] Erro não tratado no consumidor', err);
        channel.nack(raw, false, false);
      });
    });
  }

  async close(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
    this.channel = null;
    this.connection = null;
  }
}
