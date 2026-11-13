import { EventEmitter } from 'events';
import { SagaEventConsumer, RETRY_HEADER, IncomingMessage, MessageAcks } from '../../infrastructure/messaging/SagaEventConsumer';
import { OutboxRelay, IOutboxStore, OutboxRecord } from '../../infrastructure/messaging/OutboxRelay';
import { TypeORMOutboxStore } from '../../infrastructure/messaging/TypeORMOutboxStore';
import { RabbitMQClient } from '../../infrastructure/messaging/RabbitMQClient';
import { assertSagaTopology, SAGA_EVENTS_QUEUE, SAGA_EVENTS_DLQ } from '../../infrastructure/messaging/topology';
import { setNewRelicForTesting, outgoingTraceHeaders, traceMessage, getNewRelic } from '../../infrastructure/observability/tracing';
import { startSagaRuntime } from '../../infrastructure/saga/bootstrap';
import { MessageEnvelope } from '../../domain/saga/SagaMessages';
import { SagaOrchestrator } from '../../application/saga/SagaOrchestrator';
import { DataSource } from 'typeorm';

const envelope: MessageEnvelope = {
  messageId: 'm-1',
  type: 'billing.OrcamentoGerado',
  version: 1,
  sagaId: 's-1',
  correlationId: 's-1',
  causationId: null,
  osId: 'os-1',
  occurredAt: '2026-11-13T12:00:00.000Z',
  producer: 'billing-service',
  payload: { quoteId: 'q-1' },
};

const quietLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

function incoming(content: string | object, headers: Record<string, unknown> = {}): IncomingMessage {
  return { content: Buffer.from(typeof content === 'string' ? content : JSON.stringify(content)), headers, routingKey: 'billing.OrcamentoGerado' };
}

function acks(): jest.Mocked<MessageAcks> {
  return { ack: jest.fn(), deadLetter: jest.fn(), retry: jest.fn().mockResolvedValue(undefined) };
}

afterEach(() => setNewRelicForTesting(undefined));

describe('SagaEventConsumer', () => {
  it('processa o envelope e confirma (ack)', async () => {
    const handler = { handle: jest.fn().mockResolvedValue({}) };
    const a = acks();
    await new SagaEventConsumer(handler, quietLogger).onMessage(incoming(envelope), a);
    expect(handler.handle).toHaveBeenCalledWith(envelope);
    expect(a.ack).toHaveBeenCalled();
  });

  it.each([['{nao-json', 'JSON inválido'], [{ foo: 1 }, 'Envelope malformado']])('envia %p direto para a DLQ', async (content, _motivo) => {
    const handler = { handle: jest.fn() };
    const a = acks();
    await new SagaEventConsumer(handler, quietLogger).onMessage(incoming(content), a);
    expect(a.deadLetter).toHaveBeenCalled();
    expect(handler.handle).not.toHaveBeenCalled();
  });

  it('agenda nova tentativa incrementando x-retry-count', async () => {
    const handler = { handle: jest.fn().mockRejectedValue(new Error('banco fora')) };
    const a = acks();
    await new SagaEventConsumer(handler, quietLogger).onMessage(incoming(envelope, { foo: 'bar' }), a);
    expect(a.retry).toHaveBeenCalledWith({ foo: 'bar', [RETRY_HEADER]: 1 });
    expect(a.ack).not.toHaveBeenCalled();
  });

  it('manda para a DLQ após esgotar as tentativas', async () => {
    const handler = { handle: jest.fn().mockRejectedValue('erro string') };
    const a = acks();
    await new SagaEventConsumer(handler, quietLogger).onMessage(incoming(envelope, { [RETRY_HEADER]: 2 }), a);
    expect(a.deadLetter).toHaveBeenCalled();
    expect(a.retry).not.toHaveBeenCalled();
  });
});

describe('OutboxRelay', () => {
  const record = (id: string): OutboxRecord => ({ id, exchange: 'oficina.commands', routingKey: 'billing', envelope: { ...envelope, messageId: id }, attempts: 1 });

  function store(batch: OutboxRecord[]): jest.Mocked<IOutboxStore> {
    return { claimPending: jest.fn().mockResolvedValue(batch), markPublished: jest.fn(), markFailed: jest.fn() };
  }

  it('publica o lote e marca como publicado', async () => {
    const s = store([record('a'), record('b')]);
    const publisher = { publish: jest.fn().mockResolvedValue(undefined) };
    const published = await new OutboxRelay(s, publisher, quietLogger, 10).flush();
    expect(published).toBe(2);
    expect(s.claimPending).toHaveBeenCalledWith(10);
    expect(publisher.publish).toHaveBeenCalledWith('oficina.commands', 'billing', expect.objectContaining({ messageId: 'a' }));
    expect(s.markPublished).toHaveBeenCalledTimes(2);
  });

  it('devolve para PENDING a mensagem que falhou e continua o lote', async () => {
    const s = store([record('a'), record('b')]);
    const publisher = { publish: jest.fn().mockRejectedValueOnce(new Error('broker fora')).mockRejectedValueOnce('texto') };
    expect(await new OutboxRelay(s, publisher, quietLogger).flush()).toBe(0);
    expect(s.markFailed).toHaveBeenCalledWith('a', 'broker fora');
    expect(s.markFailed).toHaveBeenCalledWith('b', 'texto');
  });

  it('não roda dois ciclos ao mesmo tempo', async () => {
    let release!: () => void;
    const s: IOutboxStore = {
      claimPending: jest.fn(() => new Promise<OutboxRecord[]>((r) => (release = () => r([])))),
      markPublished: jest.fn(),
      markFailed: jest.fn(),
    };
    const relay = new OutboxRelay(s, { publish: jest.fn() }, quietLogger);
    const first = relay.flush();
    expect(await relay.flush()).toBe(0);
    release();
    await first;
    expect(s.claimPending).toHaveBeenCalledTimes(1);
  });

  it('start/stop agenda e cancela o ciclo periódico', async () => {
    jest.useFakeTimers();
    const s = store([]);
    const relay = new OutboxRelay(s, { publish: jest.fn() }, quietLogger);
    relay.start(100);
    relay.start(100);
    await jest.advanceTimersByTimeAsync(100);
    await jest.advanceTimersByTimeAsync(100);
    relay.stop();
    await jest.advanceTimersByTimeAsync(500);
    jest.useRealTimers();
    expect(s.claimPending).toHaveBeenCalledTimes(2);
  });

  it('registra erro do ciclo periódico sem derrubar o processo', async () => {
    jest.useFakeTimers();
    const logger = { error: jest.fn() };
    const relay = new OutboxRelay({ claimPending: jest.fn().mockRejectedValue(new Error('x')), markPublished: jest.fn(), markFailed: jest.fn() }, { publish: jest.fn() }, logger);
    relay.start(100);
    jest.advanceTimersByTime(100);
    relay.stop();
    jest.useRealTimers();
    await new Promise((r) => setImmediate(r));
    expect(logger.error).toHaveBeenCalledWith('[OutboxRelay] Erro no ciclo', expect.any(Object));
  });
});

describe('TypeORMOutboxStore', () => {
  const row = { id: 'a', exchange: 'oficina.commands', routing_key: 'billing', envelope, attempts: 1 };

  it('reserva mensagens com SKIP LOCKED e mapeia as linhas', async () => {
    const query = jest.fn().mockResolvedValue([row]);
    const store = new TypeORMOutboxStore({ query } as unknown as DataSource);
    const records = await store.claimPending(20);
    expect(records).toEqual([{ id: 'a', exchange: 'oficina.commands', routingKey: 'billing', envelope, attempts: 1 }]);
    expect(query.mock.calls[0][0]).toContain('FOR UPDATE SKIP LOCKED');
    expect(query.mock.calls[0][1]).toEqual([20, '60']);
  });

  it('aceita o formato [linhas, contagem] do driver pg', async () => {
    const store = new TypeORMOutboxStore({ query: jest.fn().mockResolvedValue([[row], 1]) } as unknown as DataSource);
    expect(await store.claimPending(5)).toHaveLength(1);
  });

  it('marca publicado e falha (com erro truncado)', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const store = new TypeORMOutboxStore({ query } as unknown as DataSource);
    await store.markPublished('a');
    await store.markFailed('a', 'x'.repeat(2000));
    expect(query.mock.calls[0][0]).toContain("status = 'PUBLISHED'");
    expect(query.mock.calls[1][1][1]).toHaveLength(1000);
  });
});

describe('assertSagaTopology', () => {
  it('declara exchanges, fila do orquestrador com DLX e bindings', async () => {
    const ch = { assertExchange: jest.fn(), assertQueue: jest.fn(), bindQueue: jest.fn() };
    await assertSagaTopology(ch);
    expect(ch.assertExchange).toHaveBeenCalledWith('oficina.commands', 'direct', { durable: true });
    expect(ch.assertExchange).toHaveBeenCalledWith('oficina.events', 'topic', { durable: true });
    expect(ch.assertExchange).toHaveBeenCalledWith('oficina.dlx', 'fanout', { durable: true });
    expect(ch.assertQueue).toHaveBeenCalledWith(SAGA_EVENTS_QUEUE, { durable: true, arguments: { 'x-dead-letter-exchange': 'oficina.dlx' } });
    expect(ch.bindQueue).toHaveBeenCalledWith(SAGA_EVENTS_DLQ, 'oficina.dlx', '');
    expect(ch.bindQueue).toHaveBeenCalledWith(SAGA_EVENTS_QUEUE, 'oficina.events', 'billing.#');
    expect(ch.bindQueue).toHaveBeenCalledWith(SAGA_EVENTS_QUEUE, 'oficina.events', 'execution.#');
  });
});

describe('RabbitMQClient', () => {
  function fakeChannel() {
    return {
      assertExchange: jest.fn(),
      assertQueue: jest.fn(),
      bindQueue: jest.fn(),
      prefetch: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn((_e, _r, _c, _o, cb: (err?: Error) => void) => cb()),
    };
  }

  function fakeConnection(channel: ReturnType<typeof fakeChannel>) {
    const conn = new EventEmitter() as EventEmitter & Record<string, jest.Mock>;
    conn.createConfirmChannel = jest.fn().mockResolvedValue(channel);
    conn.close = jest.fn().mockResolvedValue(undefined);
    return conn;
  }

  it('conecta com nova tentativa, declara topologia e publica com confirmação', async () => {
    const channel = fakeChannel();
    const conn = fakeConnection(channel);
    const connector = jest.fn().mockRejectedValueOnce(new Error('recusado')).mockResolvedValue(conn);
    const client = new RabbitMQClient('amqp://x', connector as never, quietLogger);

    await client.connect(3, 1);
    expect(connector).toHaveBeenCalledTimes(2);
    expect(channel.assertQueue).toHaveBeenCalled();

    await client.publish('oficina.commands', 'billing', envelope, { 'x-retry-count': 1 });
    const [ex, rk, content, opts] = channel.publish.mock.calls[0];
    expect([ex, rk]).toEqual(['oficina.commands', 'billing']);
    expect(JSON.parse(content.toString())).toEqual(envelope);
    expect(opts).toMatchObject({ persistent: true, messageId: 'm-1', type: envelope.type, headers: { 'x-retry-count': 1 } });

    conn.emit('error', new Error('x'));
    conn.emit('close');
    expect(quietLogger.error).toHaveBeenCalled();
    await client.close();
    expect(conn.close).toHaveBeenCalled();
  });

  it('desiste após o máximo de tentativas', async () => {
    const client = new RabbitMQClient('amqp://x', jest.fn().mockRejectedValue(new Error('fora')) as never, quietLogger);
    await expect(client.connect(2, 1)).rejects.toThrow('fora');
  });

  it('falha ao publicar sem conexão e propaga NACK do broker', async () => {
    const client = new RabbitMQClient('amqp://x', undefined, quietLogger);
    await expect(client.publish('e', 'r', envelope)).rejects.toThrow('RabbitMQ não conectado');

    const channel = fakeChannel();
    channel.publish.mockImplementation((_e, _r, _c, _o, cb: (err?: Error) => void) => cb(new Error('nack')));
    const ok = new RabbitMQClient('amqp://x', jest.fn().mockResolvedValue(fakeConnection(channel)) as never, quietLogger);
    await ok.connect();
    await expect(ok.publish('e', 'r', envelope)).rejects.toThrow('nack');
  });

  it('consome mensagens expondo ack, DLQ e retry', async () => {
    const channel = fakeChannel();
    const client = new RabbitMQClient('amqp://x', jest.fn().mockResolvedValue(fakeConnection(channel)) as never, quietLogger);
    await client.connect();

    const handler = jest.fn(async (_msg: IncomingMessage, a: MessageAcks) => {
      a.ack();
      a.deadLetter();
      await a.retry({ 'x-retry-count': 1 });
    });
    await client.consume('fila', handler, 5);
    expect(channel.prefetch).toHaveBeenCalledWith(5);

    const onRaw = channel.consume.mock.calls[0][1];
    onRaw(null);
    const raw = { content: Buffer.from(JSON.stringify(envelope)), properties: { headers: { a: 1 } }, fields: { routingKey: 'billing.X', exchange: 'oficina.events' } };
    onRaw(raw);
    await new Promise((r) => setImmediate(r));

    expect(handler).toHaveBeenCalledWith({ content: raw.content, headers: { a: 1 }, routingKey: 'billing.X' }, expect.any(Object));
    expect(channel.ack).toHaveBeenCalledTimes(2);
    expect(channel.nack).toHaveBeenCalledWith(raw, false, false);
    expect(channel.publish).toHaveBeenCalledWith('oficina.events', 'billing.X', expect.any(Buffer), expect.objectContaining({ headers: { 'x-retry-count': 1 } }), expect.any(Function));
  });

  it('rejeita para a DLQ se o handler lançar erro não tratado', async () => {
    const channel = fakeChannel();
    const client = new RabbitMQClient('amqp://x', jest.fn().mockResolvedValue(fakeConnection(channel)) as never, quietLogger);
    await client.connect();
    await client.consume('fila', async () => {
      throw new Error('boom');
    });
    const raw = { content: Buffer.from('{}'), properties: {}, fields: { routingKey: 'k', exchange: 'e' } };
    channel.consume.mock.calls[0][1](raw);
    await new Promise((r) => setImmediate(r));
    expect(channel.nack).toHaveBeenCalledWith(raw, false, false);
  });

  it('close sem conexão não falha', async () => {
    await expect(new RabbitMQClient('amqp://x', undefined, quietLogger).close()).resolves.toBeUndefined();
  });
});

describe('tracing (New Relic)', () => {
  function fakeNewRelic() {
    const tx = { insertDistributedTraceHeaders: jest.fn((h: Record<string, unknown>) => (h.traceparent = '00-abc')), acceptDistributedTraceHeaders: jest.fn() };
    return {
      tx,
      api: {
        getTransaction: () => tx,
        startBackgroundTransaction: jest.fn((_n: string, _g: string, fn: () => unknown) => fn()) as unknown as <T>(n: string, g: string, fn: () => T) => T,
        addCustomAttributes: jest.fn(),
        noticeError: jest.fn(),
      },
    };
  }

  it('sem licença não carrega o agente e executa direto', async () => {
    const saved = process.env.NEW_RELIC_LICENSE_KEY;
    delete process.env.NEW_RELIC_LICENSE_KEY;
    setNewRelicForTesting(undefined);
    expect(getNewRelic()).toBeNull();
    expect(outgoingTraceHeaders()).toEqual({});
    expect(await traceMessage('x', {}, {}, async () => 42)).toBe(42);
    process.env.NEW_RELIC_LICENSE_KEY = saved;
  });

  it('com licença mas sem agente instalado degrada para nulo', () => {
    const saved = process.env.NEW_RELIC_LICENSE_KEY;
    process.env.NEW_RELIC_LICENSE_KEY = 'fake';
    setNewRelicForTesting(undefined);
    jest.isolateModules(() => {
      jest.doMock('newrelic', () => {
        throw new Error('sem agente');
      });
      const t = jest.requireActual('../../infrastructure/observability/tracing');
      expect(t.getNewRelic()).toBeNull();
    });
    process.env.NEW_RELIC_LICENSE_KEY = saved;
  });

  it('propaga headers e continua o trace recebido', async () => {
    const { api, tx } = fakeNewRelic();
    setNewRelicForTesting(api);
    expect(outgoingTraceHeaders()).toEqual({ traceparent: '00-abc' });
    const result = await traceMessage('Saga/X', { traceparent: '00-in' }, { sagaId: 's' }, async () => 'ok');
    expect(result).toBe('ok');
    expect(tx.acceptDistributedTraceHeaders).toHaveBeenCalledWith('AMQP', { traceparent: '00-in' });
    expect(api.addCustomAttributes).toHaveBeenCalledWith({ sagaId: 's' });
  });

  it('registra erro no New Relic e repropaga', async () => {
    const { api } = fakeNewRelic();
    setNewRelicForTesting(api);
    await expect(traceMessage('x', {}, {}, async () => Promise.reject(new Error('falhou')))).rejects.toThrow('falhou');
    expect(api.noticeError).toHaveBeenCalled();
  });
});

describe('startSagaRuntime', () => {
  const orchestrator = { checkApprovalTimeouts: jest.fn().mockResolvedValue(0) } as unknown as SagaOrchestrator;
  const ds = { query: jest.fn().mockResolvedValue([]) } as unknown as DataSource;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('sem RABBITMQ_URL só roda o verificador de timeouts', async () => {
    jest.useFakeTimers();
    const runtime = await startSagaRuntime(ds, orchestrator, { timeoutCheckIntervalMs: 100 });
    jest.advanceTimersByTime(100);
    await runtime.stop();
    jest.useRealTimers();
    expect(orchestrator.checkApprovalTimeouts).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it('com RABBITMQ_URL conecta, inicia relay e consumidor', async () => {
    const client = { connect: jest.fn(), consume: jest.fn(), close: jest.fn(), publish: jest.fn() };
    const runtime = await startSagaRuntime(ds, orchestrator, {
      rabbitUrl: 'amqp://x',
      relayIntervalMs: 60_000,
      createRabbitClient: () => client as unknown as RabbitMQClient,
    });
    expect(client.connect).toHaveBeenCalled();
    expect(client.consume).toHaveBeenCalledWith(SAGA_EVENTS_QUEUE, expect.any(Function));
    await client.consume.mock.calls[0][1](incoming('{x'), acks());
    await runtime.stop();
    expect(client.close).toHaveBeenCalled();
  });

  it('loga timeouts processados e erros do verificador', async () => {
    jest.useFakeTimers();
    const orch = { checkApprovalTimeouts: jest.fn().mockResolvedValueOnce(2).mockRejectedValueOnce(new Error('x')) } as unknown as SagaOrchestrator;
    const runtime = await startSagaRuntime(ds, orch, { timeoutCheckIntervalMs: 100 });
    jest.advanceTimersByTime(100);
    await Promise.resolve();
    jest.advanceTimersByTime(100);
    await runtime.stop();
    jest.useRealTimers();
    await new Promise((r) => setImmediate(r));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('2 orçamento(s)'));
    expect(console.error).toHaveBeenCalled();
  });
});
