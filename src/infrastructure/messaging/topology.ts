import { Exchanges } from '../../domain/saga/SagaMessages';

/** Fila consumida pelo orquestrador (os-service). */
export const SAGA_EVENTS_QUEUE = 'os.saga.events';
export const SAGA_EVENTS_DLQ = 'os.saga.events.dlq';
/** Padrões de eventos que interessam à Saga. */
export const SAGA_EVENT_BINDINGS = ['billing.#', 'execution.#'];
export const MAX_DELIVERY_ATTEMPTS = 3;

/** Subconjunto do Channel do amqplib usado na declaração da topologia. */
export interface TopologyChannel {
  assertExchange(name: string, type: string, options?: object): Promise<unknown>;
  assertQueue(name: string, options?: object): Promise<unknown>;
  bindQueue(queue: string, exchange: string, pattern: string): Promise<unknown>;
}

/**
 * Declara (idempotentemente) a topologia descrita em docs/fase4/EVENTOS.md:
 * exchanges de comandos/eventos/DLX e a fila do orquestrador com sua DLQ.
 */
export async function assertSagaTopology(channel: TopologyChannel): Promise<void> {
  await channel.assertExchange(Exchanges.COMMANDS, 'direct', { durable: true });
  await channel.assertExchange(Exchanges.EVENTS, 'topic', { durable: true });
  await channel.assertExchange(Exchanges.DLX, 'fanout', { durable: true });

  await channel.assertQueue(SAGA_EVENTS_DLQ, { durable: true });
  await channel.bindQueue(SAGA_EVENTS_DLQ, Exchanges.DLX, '');

  await channel.assertQueue(SAGA_EVENTS_QUEUE, {
    durable: true,
    arguments: { 'x-dead-letter-exchange': Exchanges.DLX },
  });
  for (const pattern of SAGA_EVENT_BINDINGS) {
    await channel.bindQueue(SAGA_EVENTS_QUEUE, Exchanges.EVENTS, pattern);
  }
}
