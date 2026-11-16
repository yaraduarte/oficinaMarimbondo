/**
 * BDD (jest-cucumber) do fluxo completo da OS com a Saga orquestrada.
 * A OS é aberta pela API HTTP real; billing-service e execution-service são representados
 * pelos eventos que publicariam no RabbitMQ, entregues ao orquestrador como faria o consumidor.
 */
import path from 'path';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { defineFeature, loadFeature, DefineStepFunction } from 'jest-cucumber';
import app from '../../app';
import { db, outbox, resetDb } from '../support/inMemoryRepositories';
import { getSagaOrchestrator } from '../../infrastructure/saga/container';
import { MessageEnvelope } from '../../domain/saga/SagaMessages';

jest.mock('../../infrastructure/database/data-source', () => ({ AppDataSource: {} }));
jest.mock('../../infrastructure/database/repositories/TypeORMClientRepository', () => ({
  TypeORMClientRepository: jest.requireActual('../support/inMemoryRepositories').InMemoryClientRepository,
}));
jest.mock('../../infrastructure/database/repositories/TypeORMVehicleRepository', () => ({
  TypeORMVehicleRepository: jest.requireActual('../support/inMemoryRepositories').InMemoryVehicleRepository,
}));
jest.mock('../../infrastructure/database/repositories/TypeORMPartRepository', () => ({
  TypeORMPartRepository: jest.requireActual('../support/inMemoryRepositories').InMemoryPartRepository,
}));
jest.mock('../../infrastructure/database/repositories/TypeORMServiceRepository', () => ({
  TypeORMServiceRepository: jest.requireActual('../support/inMemoryRepositories').InMemoryServiceRepository,
}));
jest.mock('../../infrastructure/database/repositories/TypeORMServiceOrderRepository', () => ({
  TypeORMServiceOrderRepository: jest.requireActual('../support/inMemoryRepositories').InMemoryServiceOrderRepository,
}));
jest.mock('../../infrastructure/database/repositories/TypeORMUserRepository', () => ({
  TypeORMUserRepository: jest.requireActual('../support/inMemoryRepositories').InMemoryUserRepository,
}));
jest.mock('../../infrastructure/database/repositories/TypeORMSagaPersistence', () => ({
  TypeORMSagaUnitOfWork: jest.requireActual('../support/inMemoryRepositories').InMemorySagaUnitOfWork,
}));
jest.mock('../../infrastructure/notification/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({ sendStatusUpdate: jest.fn().mockResolvedValue(undefined) })),
}));

const feature = loadFeature(path.join(__dirname, 'features', 'saga-ordem-de-servico.feature'), { tagFilter: undefined });
const token = jwt.sign({ sub: 'admin', role: 'ADMIN' }, 'dev-secret');
const auth = { Authorization: `Bearer ${token}` };

/** Payloads mínimos que cada serviço publicaria (docs/fase4/EVENTOS.md). */
const PAYLOADS: Record<string, Record<string, unknown>> = {
  'billing.OrcamentoGerado': { quoteId: 'q-1', totalCents: 25000, expiresAt: '2099-01-01T00:00:00Z' },
  'billing.OrcamentoAprovado': { quoteId: 'q-1', paymentId: 'pay-1', checkoutUrl: 'https://mp/checkout' },
  'billing.PagamentoConfirmado': { paymentId: 'pay-1', quoteId: 'q-1', mpPaymentId: '123', amountCents: 25000 },
  'billing.PagamentoEstornado': { paymentId: 'pay-1', mpRefundId: 'r-1', amountCents: 25000 },
  'billing.OrcamentoCancelado': { quoteId: 'q-1' },
  'execution.ExecucaoIniciada': { executionId: 'exe-1', queuePosition: 1 },
  'execution.DiagnosticoIniciado': { executionId: 'exe-1', mechanicId: 'mec-1' },
  'execution.ReparoIniciado': { executionId: 'exe-1' },
  'execution.ExecucaoFinalizada': { executionId: 'exe-1', finishedAt: '2026-11-13T18:00:00Z' },
  'execution.ExecucaoRecusada': {
    reason: 'ESTOQUE_INSUFICIENTE',
    missingParts: [{ partId: 'p-1', requested: 2, available: 0 }],
  },
};

interface World {
  clientId: string;
  vehicleId: string;
  serviceId: string;
  partId: string;
  orderId: string;
  sagaId: string;
  seq: number;
}

let world: World;

function envelope(type: string, messageId = `evt-${++world.seq}`): MessageEnvelope {
  return {
    messageId,
    type,
    version: 1,
    sagaId: world.sagaId,
    correlationId: world.sagaId,
    causationId: null,
    osId: world.orderId,
    occurredAt: new Date().toISOString(),
    producer: type.split('.')[0] === 'billing' ? 'billing-service' : 'execution-service',
    payload: PAYLOADS[type] ?? {},
  };
}

const publish = (type: string) => getSagaOrchestrator().handle(envelope(type));
const commandsOf = (type: string) => outbox.filter((m) => m.envelope.type === type);

async function openOrder() {
  const res = await request(app)
    .post('/api/service-orders')
    .set(auth)
    .send({ clientId: world.clientId, vehicleId: world.vehicleId, serviceIds: [world.serviceId], parts: [{ partId: world.partId, quantity: 2 }] });
  expect(res.status).toBe(201);
  world.orderId = res.body.data.id;
  world.sagaId = res.body.saga.id;
}

function background(given: DefineStepFunction, and: DefineStepFunction) {
  given('um cliente ativo com veículo cadastrado', async () => {
    resetDb();
    world = { seq: 0 } as World;
    const c = await request(app)
      .post('/api/clients')
      .set(auth)
      .send({ name: 'João Silva', cpfCnpj: '111.444.777-35', email: 'joao@email.com', phone: '11999999999' });
    world.clientId = c.body.data.id;
    const v = await request(app)
      .post('/api/vehicles')
      .set(auth)
      .send({ plate: 'ABC1D23', brand: 'Fiat', model: 'Uno', year: 2015, clientId: world.clientId });
    world.vehicleId = v.body.data.id;
  });

  and(/^um serviço de "(.*)" custando (\d+) reais$/, async (name: string, price: string) => {
    const s = await request(app).post('/api/services').set(auth).send({ name, description: name, price: Number(price), estimatedHours: 1 });
    world.serviceId = s.body.data.id;
  });

  and(/^uma peça "(.*)" custando (\d+) reais$/, async (name: string, price: string) => {
    const p = await request(app)
      .post('/api/parts')
      .set(auth)
      .send({ name, description: name, unitPrice: Number(price), stockQuantity: 10, minStockAlert: 1 });
    world.partId = p.body.data.id;
  });
}

async function expectState(osStatus: string, sagaStatus: string) {
  const os = await request(app).get(`/api/service-orders/${world.orderId}/status`);
  expect(os.body.data.order.status).toBe(osStatus);
  const saga = await request(app).get(`/api/service-orders/${world.orderId}/saga`).set(auth);
  expect(saga.body.data.status).toBe(sagaStatus);
}

async function orderWithPaymentConfirmed() {
  await openOrder();
  for (const type of ['billing.OrcamentoGerado', 'billing.OrcamentoAprovado', 'billing.PagamentoConfirmado', 'execution.ExecucaoIniciada']) {
    await publish(type);
  }
}

defineFeature(feature, (test) => {
  test('Fluxo completo da OS passando por todos os microsserviços', ({ given, and, when, then }) => {
    background(given, and);

    when('o atendente abre uma OS com o serviço e 2 unidades da peça', openOrder);

    then(/^a OS fica "(.*)" e a saga "(.*)"$/, expectState);

    and(/^o comando "(.*)" é enviado com total de (\d+) centavos$/, (type: string, total: string) => {
      const [cmd] = commandsOf(type);
      const items = cmd.envelope.payload.items as { quantity: number; unitPriceCents: number }[];
      expect(items.reduce((sum, i) => sum + i.quantity * i.unitPriceCents, 0)).toBe(Number(total));
      expect(cmd.routingKey).toBe('billing');
    });

    when(/^o billing-service publica "(.*)"$/, publish);
    then(/^a OS fica "(.*)" e a saga "(.*)"$/, expectState);
    when(/^o billing-service publica "(.*)"$/, publish);
    then(/^a OS fica "(.*)" e a saga "(.*)"$/, expectState);
    when(/^o billing-service publica "(.*)"$/, publish);
    then(/^a OS fica "(.*)" e a saga "(.*)"$/, expectState);

    and(/^o comando "(.*)" é enviado$/, (type: string) => {
      expect(commandsOf(type)).toHaveLength(1);
      expect(commandsOf(type)[0].envelope.payload).toMatchObject({ quoteId: 'q-1', parts: [{ partId: world.partId, quantity: 2 }] });
    });

    when(/^o execution-service publica "(.*)"$/, publish);
    then(/^a OS fica "(.*)" e a saga "(.*)"$/, expectState);
    when(/^o execution-service publica "(.*)"$/, publish);
    then(/^a OS fica "(.*)" e a saga "(.*)"$/, expectState);
    when(/^o execution-service publica "(.*)"$/, publish);
    then(/^a OS fica "(.*)" e a saga "(.*)"$/, expectState);
  });

  test('Falta de estoque na execução estorna o pagamento e cancela o orçamento', ({ given, and, when, then }) => {
    background(given, and);

    given('uma OS com pagamento confirmado', orderWithPaymentConfirmed);

    when(/^o execution-service publica "(.*)"$/, publish);
    then(/^a OS fica "(.*)" e a saga "(.*)"$/, expectState);

    and(/^o comando "(.*)" é enviado$/, (type: string) => {
      expect(commandsOf(type)).toEqual([
        expect.objectContaining({ envelope: expect.objectContaining({ payload: expect.objectContaining({ paymentId: 'pay-1' }) }) }),
      ]);
    });

    when(/^o billing-service publica "(.*)"$/, publish);

    then(/^o comando "(.*)" é enviado$/, (type: string) => {
      expect(commandsOf(type)).toEqual([
        expect.objectContaining({ envelope: expect.objectContaining({ payload: expect.objectContaining({ quoteId: 'q-1' }) }) }),
      ]);
    });

    when(/^o billing-service publica "(.*)"$/, publish);
    then(/^a OS fica "(.*)" e a saga "(.*)"$/, expectState);
  });

  test('Evento reentregue pelo broker não é processado duas vezes', ({ given, and, when, then }) => {
    background(given, and);

    given('uma OS com pagamento confirmado', orderWithPaymentConfirmed);

    when(/^o mesmo evento "(.*)" é entregue duas vezes$/, async (type: string) => {
      const evt = envelope(type, 'reentrega-1');
      await getSagaOrchestrator().handle(evt);
      const second = await getSagaOrchestrator().handle(evt);
      expect(second.duplicate).toBe(true);
    });

    then(/^apenas um comando "(.*)" é enviado$/, (type: string) => {
      expect(commandsOf(type)).toHaveLength(1);
      expect(db.processed.has('reentrega-1')).toBe(true);
    });
  });
});
