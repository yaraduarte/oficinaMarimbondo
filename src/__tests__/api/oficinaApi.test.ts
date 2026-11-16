/**
 * Testes de API (supertest) sobre o app Express real.
 * Apenas a persistência é substituída por repositórios em memória; rotas, middlewares,
 * controllers, casos de uso e tratamento de erros são exercitados de ponta a ponta.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { db, outbox, resetDb } from '../support/inMemoryRepositories';
import { SagaOrchestrator } from '../../application/saga/SagaOrchestrator';
import { SagaStatus } from '../../domain/saga/ServiceOrderSaga';
import { Client } from '../../domain/entities/Client';
import { ClientStatus } from '../../domain/enums/ClientStatus';
import { UserRole } from '../../domain/enums/UserRole';
import { ServiceOrderStatus } from '../../domain/enums/ServiceOrderStatus';

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

const SECRET = 'dev-secret';
const adminToken = jwt.sign({ sub: 'admin-1', role: UserRole.ADMIN }, SECRET);
const mechanicToken = jwt.sign({ sub: 'mec-1', role: UserRole.MECHANIC }, SECRET);
const auth = (token = adminToken) => ({ Authorization: `Bearer ${token}` });

async function createClient(overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/clients')
    .set(auth())
    .send({ name: 'João Silva', cpfCnpj: '111.444.777-35', email: 'joao@email.com', phone: '11999999999', ...overrides });
  return res.body.data;
}

async function createVehicle(clientId: string, plate = 'ABC1D23') {
  const res = await request(app)
    .post('/api/vehicles')
    .set(auth())
    .send({ plate, brand: 'Fiat', model: 'Uno', year: 2015, clientId });
  return res.body.data;
}

async function createService(name = 'Troca de óleo', price = 150) {
  const res = await request(app)
    .post('/api/services')
    .set(auth())
    .send({ name, description: 'Serviço', price, estimatedHours: 1 });
  return res.body.data;
}

async function createPart(name = 'Filtro de óleo', unitPrice = 50, stockQuantity = 10) {
  const res = await request(app)
    .post('/api/parts')
    .set(auth())
    .send({ name, description: 'Peça', unitPrice, stockQuantity, minStockAlert: 2 });
  return res.body.data;
}

beforeEach(() => {
  resetDb();
  delete process.env.ORIGIN_VERIFY_SECRET;
  delete process.env.INTERNAL_API_KEY;
});

describe('infraestrutura HTTP', () => {
  it('GET /health responde ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('responde 400 para JSON malformado', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set(auth())
      .set('Content-Type', 'application/json')
      .send('{"name": ');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('JSON inválido no corpo da requisição');
  });

  it('responde 401 sem token e com token inválido', async () => {
    expect((await request(app).get('/api/clients')).status).toBe(401);
    expect((await request(app).get('/api/clients').set('Authorization', 'Bearer xpto')).status).toBe(401);
  });

  it('recusa acesso direto quando ORIGIN_VERIFY_SECRET está ativo', async () => {
    process.env.ORIGIN_VERIFY_SECRET = 'gw';
    expect((await request(app).get('/api/clients').set(auth())).status).toBe(403);
    expect((await request(app).get('/api/clients').set(auth()).set('x-origin-verify', 'gw')).status).toBe(200);
  });

  it('responde 500 genérico para erros inesperados', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const original = db.clients.values;
    db.clients.values = () => {
      throw new Error('falha no banco');
    };
    const res = await request(app).get('/api/clients').set(auth());
    db.clients.values = original;
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Erro interno do servidor');
  });
});

describe('/api/auth', () => {
  it('registra e faz login de funcionário', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana', email: 'ANA@oficina.com', password: 'segredo123', role: UserRole.ADMIN });
    expect(reg.status).toBe(201);
    expect(reg.body.data.passwordHash).toBeUndefined();

    const login = await request(app).post('/api/auth/login').send({ email: 'ana@oficina.com', password: 'segredo123' });
    expect(login.status).toBe(200);
    expect(login.body.data.token).toEqual(expect.any(String));

    const wrong = await request(app).post('/api/auth/login').send({ email: 'ana@oficina.com', password: 'errada' });
    expect(wrong.status).toBe(401);
  });
});

describe('/api/clients', () => {
  it('CRUD completo com paginação e filtro', async () => {
    const created = await createClient();
    expect(created.status).toBe(ClientStatus.ATIVO);
    await createClient({ name: 'Maria', cpfCnpj: '529.982.247-25', email: 'maria@email.com' });

    const list = await request(app).get('/api/clients?page=1&limit=1&name=mar').set(auth());
    expect(list.body.data).toMatchObject({ total: 1, page: 1, limit: 1 });
    expect(list.body.data.data[0].name).toBe('Maria');

    const all = await request(app).get('/api/clients').set(auth());
    expect(all.body.data.total).toBe(2);

    const got = await request(app).get(`/api/clients/${created.id}`).set(auth());
    expect(got.body.data.email).toBe('joao@email.com');

    const upd = await request(app)
      .put(`/api/clients/${created.id}`)
      .set(auth())
      .send({ name: 'João Atualizado', email: 'NOVO@email.com', phone: '11988887777' });
    expect(upd.body.data).toMatchObject({ name: 'João Atualizado', email: 'novo@email.com', phone: '11988887777' });

    const del = await request(app).delete(`/api/clients/${created.id}`).set(auth());
    expect(del.status).toBe(204);
    expect((await request(app).get(`/api/clients/${created.id}`).set(auth())).status).toBe(404);
  });

  it('retorna 404 ao atualizar cliente inexistente', async () => {
    const res = await request(app).put('/api/clients/nao-existe').set(auth()).send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('PATCH /status exige ADMIN e altera o status', async () => {
    const c = await createClient();
    const forbidden = await request(app)
      .patch(`/api/clients/${c.id}/status`)
      .set(auth(mechanicToken))
      .send({ status: ClientStatus.BLOQUEADO });
    expect(forbidden.status).toBe(403);

    const ok = await request(app).patch(`/api/clients/${c.id}/status`).set(auth()).send({ status: ClientStatus.BLOQUEADO });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe(ClientStatus.BLOQUEADO);
  });
});

describe('/internal/clients/by-cpf', () => {
  it('exige x-internal-api-key e devolve status do cliente', async () => {
    const c = await createClient();
    expect((await request(app).get('/internal/clients/by-cpf/11144477735')).status).toBe(503);

    process.env.INTERNAL_API_KEY = 'k-123';
    expect((await request(app).get('/internal/clients/by-cpf/11144477735').set('x-internal-api-key', 'x')).status).toBe(401);

    const ok = await request(app).get('/internal/clients/by-cpf/11144477735').set('x-internal-api-key', 'k-123');
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ id: c.id, status: ClientStatus.ATIVO, active: true });
  });
});

describe('/api/vehicles', () => {
  it('CRUD completo', async () => {
    const c = await createClient();
    const v = await createVehicle(c.id);
    expect(v.plate).toBe('ABC1D23');

    expect((await request(app).get('/api/vehicles').set(auth())).body.data).toHaveLength(1);
    expect((await request(app).get(`/api/vehicles/${v.id}`).set(auth())).body.data.model).toBe('Uno');

    const upd = await request(app).put(`/api/vehicles/${v.id}`).set(auth()).send({ brand: 'VW', model: 'Gol', year: 2020 });
    expect(upd.body.data).toMatchObject({ brand: 'VW', model: 'Gol', year: 2020 });

    expect((await request(app).delete(`/api/vehicles/${v.id}`).set(auth())).status).toBe(204);
    expect((await request(app).get(`/api/vehicles/${v.id}`).set(auth())).status).toBe(404);
  });

  it('retorna 404 para atualizar/remover veículo inexistente', async () => {
    expect((await request(app).put('/api/vehicles/x').set(auth()).send({ brand: 'A' })).status).toBe(404);
    expect((await request(app).delete('/api/vehicles/x').set(auth())).status).toBe(404);
  });
});

describe('/api/services', () => {
  it('CRUD completo', async () => {
    const s = await createService();
    expect((await request(app).get('/api/services').set(auth())).body.data).toHaveLength(1);
    expect((await request(app).get(`/api/services/${s.id}`).set(auth())).body.data.price).toBe(150);

    const upd = await request(app)
      .put(`/api/services/${s.id}`)
      .set(auth())
      .send({ name: 'Alinhamento', description: 'Novo', price: 99, estimatedHours: 2 });
    expect(upd.body.data).toMatchObject({ name: 'Alinhamento', description: 'Novo', price: 99, estimatedHours: 2 });

    expect((await request(app).delete(`/api/services/${s.id}`).set(auth())).status).toBe(204);
    expect((await request(app).get(`/api/services/${s.id}`).set(auth())).status).toBe(404);
  });

  it('retorna 404 para atualizar/remover serviço inexistente', async () => {
    expect((await request(app).put('/api/services/x').set(auth()).send({ price: 1 })).status).toBe(404);
    expect((await request(app).delete('/api/services/x').set(auth())).status).toBe(404);
  });
});

describe('/api/parts', () => {
  it('CRUD completo', async () => {
    const p = await createPart();
    expect((await request(app).get('/api/parts').set(auth())).body.data).toHaveLength(1);
    expect((await request(app).get(`/api/parts/${p.id}`).set(auth())).body.data.stockQuantity).toBe(10);

    const upd = await request(app)
      .put(`/api/parts/${p.id}`)
      .set(auth())
      .send({ name: 'Filtro', description: 'Novo', unitPrice: 60, stockQuantity: 1, minStockAlert: 3 });
    expect(upd.body.data).toMatchObject({ name: 'Filtro', unitPrice: 60, stockQuantity: 1, minStockAlert: 3 });

    expect((await request(app).delete(`/api/parts/${p.id}`).set(auth())).status).toBe(204);
    expect((await request(app).get(`/api/parts/${p.id}`).set(auth())).status).toBe(404);
  });

  it('retorna 404 para atualizar/remover peça inexistente', async () => {
    expect((await request(app).put('/api/parts/x').set(auth()).send({ unitPrice: 1 })).status).toBe(404);
    expect((await request(app).delete('/api/parts/x').set(auth())).status).toBe(404);
  });
});

describe('/api/service-orders', () => {
  async function openOrder() {
    const c = await createClient();
    const v = await createVehicle(c.id);
    const s = await createService();
    const p = await createPart();
    const res = await request(app)
      .post('/api/service-orders')
      .set(auth())
      .send({ clientId: c.id, vehicleId: v.id, serviceIds: [s.id], parts: [{ partId: p.id, quantity: 2 }], notes: 'Barulho' });
    return { res, client: c as Client };
  }

  it('abre OS, consulta status publicamente e lista ativas', async () => {
    const { res } = await openOrder();
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: ServiceOrderStatus.RECEBIDA, budget: 250 });
    expect(res.body.saga).toMatchObject({ status: SagaStatus.AGUARDANDO_ORCAMENTO });
    expect(outbox.map((m) => m.envelope.type)).toEqual(['billing.GerarOrcamento']);

    const saga = await request(app).get(`/api/service-orders/${res.body.data.id}/saga`).set(auth());
    expect(saga.status).toBe(200);
    expect(saga.body.data).toMatchObject({ id: res.body.saga.id, serviceOrderId: res.body.data.id });
    expect((await request(app).get('/api/service-orders/x/saga').set(auth())).status).toBe(404);

    const status = await request(app).get(`/api/service-orders/${res.body.data.id}/status`);
    expect(status.status).toBe(200);
    expect(status.body.data.statusHistory).toEqual([ServiceOrderStatus.RECEBIDA]);

    const list = await request(app).get('/api/service-orders').set(auth());
    expect(list.body.data).toHaveLength(1);
  });

  it('percorre o fluxo de status até a aprovação do orçamento', async () => {
    const { res } = await openOrder();
    const id = res.body.data.id;

    for (const status of [ServiceOrderStatus.EM_DIAGNOSTICO, ServiceOrderStatus.AGUARDANDO_APROVACAO]) {
      const upd = await request(app).patch(`/api/service-orders/${id}/status`).set(auth()).send({ status });
      expect(upd.status).toBe(200);
      expect(upd.body.data.status).toBe(status);
    }

    const approve = await request(app).post(`/api/service-orders/${id}/approve`).send({ decision: 'approved' });
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe(ServiceOrderStatus.EM_EXECUCAO);
  });

  it('valida veículo, serviços e estoque ao abrir OS', async () => {
    const c = await createClient();
    const other = await createClient({ name: 'Outro', cpfCnpj: '529.982.247-25', email: 'o@e.com' });
    const v = await createVehicle(other.id);
    const s = await createService();
    const p = await createPart('Vela', 20, 1);
    const open = (body: Record<string, unknown>) =>
      request(app).post('/api/service-orders').set(auth()).send({ clientId: c.id, vehicleId: v.id, serviceIds: [s.id], parts: [], ...body });

    expect((await open({ vehicleId: 'nao-existe' })).status).toBe(404);
    expect((await open({})).status).toBe(422);

    const own = await createVehicle(c.id, 'XYZ9K88');
    expect((await open({ vehicleId: own.id, serviceIds: [s.id, 'nao-existe'] })).status).toBe(404);
    expect((await open({ vehicleId: own.id, parts: [{ partId: 'nao-existe', quantity: 1 }] })).status).toBe(404);
    const noStock = await open({ vehicleId: own.id, parts: [{ partId: p.id, quantity: 5 }] });
    expect(noStock.status).toBe(422);
    expect(noStock.body.message).toBe('Estoque insuficiente para a peça: Vela');
  });

  it('grava a OS mesmo se a saga não puder ser iniciada', async () => {
    const spy = jest.spyOn(SagaOrchestrator.prototype, 'start').mockRejectedValueOnce(new Error('banco fora'));
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { res } = await openOrder();
    spy.mockRestore();
    err.mockRestore();
    expect(res.status).toBe(201);
    expect(res.body.saga).toBeNull();
  });

  it('recusa transição inválida e OS inexistente', async () => {
    const { res } = await openOrder();
    const invalid = await request(app)
      .patch(`/api/service-orders/${res.body.data.id}/status`)
      .set(auth())
      .send({ status: ServiceOrderStatus.ENTREGUE });
    expect(invalid.status).toBeGreaterThanOrEqual(400);
    expect((await request(app).get('/api/service-orders/x/status')).status).toBe(404);
  });
});
