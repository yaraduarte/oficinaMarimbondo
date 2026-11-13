/**
 * Testes unitários dos repositórios TypeORM: o Repository do TypeORM é simulado,
 * validando as consultas montadas e o mapeamento entidade ↔ domínio.
 */
import { DataSource } from 'typeorm';
import { TypeORMClientRepository } from '../../infrastructure/database/repositories/TypeORMClientRepository';
import { TypeORMVehicleRepository } from '../../infrastructure/database/repositories/TypeORMVehicleRepository';
import { TypeORMPartRepository } from '../../infrastructure/database/repositories/TypeORMPartRepository';
import { TypeORMServiceRepository } from '../../infrastructure/database/repositories/TypeORMServiceRepository';
import { TypeORMServiceOrderRepository } from '../../infrastructure/database/repositories/TypeORMServiceOrderRepository';
import { TypeORMUserRepository } from '../../infrastructure/database/repositories/TypeORMUserRepository';
import { Client } from '../../domain/entities/Client';
import { Vehicle } from '../../domain/entities/Vehicle';
import { Part } from '../../domain/entities/Part';
import { Service } from '../../domain/entities/Service';
import { ServiceOrder } from '../../domain/entities/ServiceOrder';
import { User } from '../../domain/entities/User';
import { ClientStatus } from '../../domain/enums/ClientStatus';
import { ServiceOrderStatus } from '../../domain/enums/ServiceOrderStatus';
import { UserRole } from '../../domain/enums/UserRole';

function makeQueryBuilder(result: { count?: number; many?: unknown[] } = {}) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['withDeleted', 'where', 'andWhere', 'skip', 'take', 'orderBy']) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getCount = jest.fn(async () => result.count ?? 0);
  qb.getMany = jest.fn(async () => result.many ?? []);
  return qb;
}

function makeRepo(qb = makeQueryBuilder()) {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    findBy: jest.fn().mockResolvedValue([]),
    save: jest.fn(async (e: unknown) => e),
    delete: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
  };
}

function dataSourceFor(repo: ReturnType<typeof makeRepo>): DataSource {
  return { getRepository: jest.fn(() => repo) } as unknown as DataSource;
}

const now = new Date('2026-01-01T00:00:00Z');

describe('TypeORMClientRepository', () => {
  const entity = {
    id: 'c-1', name: 'João', cpfCnpj: '11144477735', email: 'j@e.com', phone: '1',
    status: ClientStatus.ATIVO, createdAt: now, updatedAt: now, deletedAt: null,
  };

  it('busca por id, CPF e e-mail mapeando para o domínio', async () => {
    const repo = makeRepo();
    repo.findOne.mockResolvedValue(entity);
    const r = new TypeORMClientRepository(dataSourceFor(repo));

    const byId = await r.findById('c-1');
    expect(byId).toBeInstanceOf(Client);
    expect(byId?.isActive()).toBe(true);
    expect(await r.findByCpfCnpj('11144477735')).toMatchObject({ id: 'c-1' });
    expect(await r.findByEmail('j@e.com')).toMatchObject({ id: 'c-1' });
    expect(repo.findOne).toHaveBeenCalledWith({ where: { cpfCnpj: '11144477735' } });

    repo.findOne.mockResolvedValue(null);
    expect(await r.findById('x')).toBeNull();
    expect(await r.findByCpfCnpj('x')).toBeNull();
    expect(await r.findByEmail('x')).toBeNull();
  });

  it('pagina e filtra por nome ignorando removidos', async () => {
    const qb = makeQueryBuilder({ count: 11, many: [entity] });
    const r = new TypeORMClientRepository(dataSourceFor(makeRepo(qb)));

    const result = await r.findAll({ page: 2, limit: 10, name: 'JOÃO' });

    expect(result).toMatchObject({ total: 11, page: 2, limit: 10 });
    expect(result.data[0]).toBeInstanceOf(Client);
    expect(qb.where).toHaveBeenCalledWith('client.deleted_at IS NULL');
    expect(qb.andWhere).toHaveBeenCalledWith(expect.any(String), { name: '%joão%' });
    expect(qb.skip).toHaveBeenCalledWith(10);
  });

  it('não filtra por nome quando não informado', async () => {
    const qb = makeQueryBuilder();
    await new TypeORMClientRepository(dataSourceFor(makeRepo(qb))).findAll({ page: 1, limit: 5 });
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('salva, atualiza e remove (soft delete)', async () => {
    const repo = makeRepo();
    const r = new TypeORMClientRepository(dataSourceFor(repo));
    const client = new Client(entity);
    expect(await r.save(client)).toMatchObject({ id: 'c-1' });
    expect(await r.update(client)).toMatchObject({ id: 'c-1' });
    await r.softDelete('c-1');
    expect(repo.save).toHaveBeenCalledTimes(2);
    expect(repo.softDelete).toHaveBeenCalledWith('c-1');
  });
});

describe('TypeORMVehicleRepository', () => {
  const entity = { id: 'v-1', plate: 'ABC1D23', brand: 'Fiat', model: 'Uno', year: 2015, clientId: 'c-1', createdAt: now, updatedAt: now };

  it('consulta, salva e remove', async () => {
    const repo = makeRepo();
    repo.findOne.mockResolvedValueOnce(entity).mockResolvedValueOnce(entity).mockResolvedValue(null);
    repo.find.mockResolvedValue([entity]);
    const r = new TypeORMVehicleRepository(dataSourceFor(repo));

    expect(await r.findById('v-1')).toBeInstanceOf(Vehicle);
    expect(await r.findByPlate('ABC1D23')).toMatchObject({ plate: 'ABC1D23' });
    expect(await r.findById('x')).toBeNull();
    expect(await r.findByPlate('x')).toBeNull();
    expect(await r.findByClientId('c-1')).toHaveLength(1);
    expect(repo.find).toHaveBeenCalledWith({ where: { clientId: 'c-1' } });
    expect(await r.findAll()).toHaveLength(1);

    const v = new Vehicle(entity);
    await r.save(v);
    await r.update(v);
    await r.delete('v-1');
    expect(repo.save).toHaveBeenCalledTimes(2);
    expect(repo.delete).toHaveBeenCalledWith('v-1');
  });
});

describe('TypeORMPartRepository', () => {
  const entity = { id: 'p-1', name: 'Filtro', description: 'd', unitPrice: '50.00', stockQuantity: 3, minStockAlert: 5, createdAt: now, updatedAt: now };

  it('converte decimais e calcula estoque baixo', async () => {
    const repo = makeRepo();
    repo.findOne.mockResolvedValueOnce(entity).mockResolvedValue(null);
    repo.find.mockResolvedValue([entity]);
    const r = new TypeORMPartRepository(dataSourceFor(repo));

    const part = await r.findById('p-1');
    expect(part).toBeInstanceOf(Part);
    expect(part?.unitPrice).toBe(50);
    expect(part?.isLowStock).toBe(true);
    expect(await r.findById('x')).toBeNull();
    expect(await r.findAll()).toHaveLength(1);

    const p = new Part({ ...entity, unitPrice: 50 });
    await r.save(p);
    await r.update(p);
    await r.delete('p-1');
    expect(repo.delete).toHaveBeenCalledWith('p-1');
  });
});

describe('TypeORMServiceRepository', () => {
  const entity = { id: 's-1', name: 'Óleo', description: 'd', price: '150.00', estimatedHours: '1.5', createdAt: now, updatedAt: now };

  it('consulta por ids, converte decimais, salva e remove', async () => {
    const repo = makeRepo();
    repo.findOne.mockResolvedValueOnce(entity).mockResolvedValue(null);
    repo.findBy.mockResolvedValue([entity]);
    repo.find.mockResolvedValue([entity]);
    const r = new TypeORMServiceRepository(dataSourceFor(repo));

    const s = await r.findById('s-1');
    expect(s).toBeInstanceOf(Service);
    expect(s).toMatchObject({ price: 150, estimatedHours: 1.5 });
    expect(await r.findById('x')).toBeNull();
    expect(await r.findByIds([])).toEqual([]);
    expect(repo.findBy).not.toHaveBeenCalled();
    expect(await r.findByIds(['s-1'])).toHaveLength(1);
    expect(await r.findAll()).toHaveLength(1);

    const svc = new Service({ ...entity, price: 150, estimatedHours: 1.5 });
    await r.save(svc);
    await r.update(svc);
    await r.delete('s-1');
    expect(repo.delete).toHaveBeenCalledWith('s-1');
  });
});

describe('TypeORMServiceOrderRepository', () => {
  const entity = {
    id: 'o-1', orderNumber: 'OS-2026-001', status: ServiceOrderStatus.RECEBIDA, clientId: 'c-1', vehicleId: 'v-1',
    services: [], parts: [], budget: '250.00', notes: null, approvedAt: null, createdAt: now, updatedAt: now, deletedAt: null,
  };

  it('consulta, lista ativas e gera número sequencial por ano', async () => {
    const qb = makeQueryBuilder({ count: 41 });
    const repo = makeRepo(qb);
    repo.findOne.mockResolvedValueOnce(entity).mockResolvedValue(null);
    repo.find.mockResolvedValue([entity]);
    const r = new TypeORMServiceOrderRepository(dataSourceFor(repo));

    const order = await r.findById('o-1');
    expect(order).toBeInstanceOf(ServiceOrder);
    expect(order?.budget).toBe(250);
    expect(await r.findById('x')).toBeNull();
    expect(await r.findAll()).toHaveLength(1);
    expect(await r.findActiveOrdered()).toHaveLength(1);
    expect(repo.find).toHaveBeenLastCalledWith(expect.objectContaining({ order: { createdAt: 'ASC' } }));

    const year = new Date().getFullYear();
    expect(await r.getNextOrderNumber()).toBe(`OS-${year}-042`);
    expect(qb.withDeleted).toHaveBeenCalled();
  });

  it('salva, atualiza e remove (soft delete)', async () => {
    const repo = makeRepo();
    const r = new TypeORMServiceOrderRepository(dataSourceFor(repo));
    const o = new ServiceOrder({ ...entity, budget: 250 });
    await r.save(o);
    await r.update(o);
    await r.softDelete('o-1');
    expect(repo.save).toHaveBeenCalledTimes(2);
    expect(repo.softDelete).toHaveBeenCalledWith('o-1');
  });
});

describe('TypeORMUserRepository', () => {
  const entity = { id: 'u-1', name: 'Ana', email: 'a@o.com', passwordHash: 'h', role: UserRole.ADMIN, createdAt: now, updatedAt: now };

  it('consulta e salva usuários', async () => {
    const repo = makeRepo();
    repo.findOne.mockResolvedValueOnce(entity).mockResolvedValueOnce(entity).mockResolvedValue(null);
    const r = new TypeORMUserRepository(dataSourceFor(repo));

    expect(await r.findById('u-1')).toBeInstanceOf(User);
    expect(await r.findByEmail('a@o.com')).toMatchObject({ role: UserRole.ADMIN });
    expect(await r.findById('x')).toBeNull();
    expect(await r.findByEmail('x')).toBeNull();
    expect(await r.save(new User(entity))).toMatchObject({ id: 'u-1' });
  });
});
