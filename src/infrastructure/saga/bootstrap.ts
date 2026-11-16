import { DataSource } from 'typeorm';
import { SagaOrchestrator } from '../../application/saga/SagaOrchestrator';
import { RabbitMQClient } from '../messaging/RabbitMQClient';
import { OutboxRelay } from '../messaging/OutboxRelay';
import { TypeORMOutboxStore } from '../messaging/TypeORMOutboxStore';
import { SagaEventConsumer } from '../messaging/SagaEventConsumer';
import { SAGA_EVENTS_QUEUE } from '../messaging/topology';

export interface SagaRuntime {
  stop(): Promise<void>;
}

export interface SagaRuntimeOptions {
  rabbitUrl?: string;
  relayIntervalMs?: number;
  timeoutCheckIntervalMs?: number;
  createRabbitClient?: (url: string) => RabbitMQClient;
}

/**
 * Sobe os componentes assíncronos da Saga:
 * - verificador de timeout de aprovação (só precisa do banco)
 * - conexão RabbitMQ, relay do outbox e consumidor de eventos (se RABBITMQ_URL estiver definida)
 */
export async function startSagaRuntime(
  dataSource: DataSource,
  orchestrator: SagaOrchestrator,
  options: SagaRuntimeOptions = {},
): Promise<SagaRuntime> {
  const timeoutTimer = setInterval(() => {
    orchestrator
      .checkApprovalTimeouts()
      .then((n) => n > 0 && console.log(`[Saga] ${n} orçamento(s) expirado(s) entraram em compensação`))
      .catch((err) => console.error('[Saga] Falha ao verificar timeouts', err));
  }, options.timeoutCheckIntervalMs ?? 60_000);
  timeoutTimer.unref?.();

  if (!options.rabbitUrl) {
    console.warn('[Saga] RABBITMQ_URL não definida: mensagens ficam no outbox até o broker ser configurado');
    return {
      stop: async () => clearInterval(timeoutTimer),
    };
  }

  const client = options.createRabbitClient ? options.createRabbitClient(options.rabbitUrl) : new RabbitMQClient(options.rabbitUrl);
  await client.connect();

  const relay = new OutboxRelay(new TypeORMOutboxStore(dataSource), client);
  relay.start(options.relayIntervalMs ?? 1000);

  const consumer = new SagaEventConsumer(orchestrator);
  await client.consume(SAGA_EVENTS_QUEUE, (msg, acks) => consumer.onMessage(msg, acks));
  console.log(`[Saga] Consumindo ${SAGA_EVENTS_QUEUE}`);

  return {
    stop: async () => {
      clearInterval(timeoutTimer);
      relay.stop();
      await client.close();
    },
  };
}
