/**
 * Repositórios em memória usados pelos testes de API (supertest).
 * Substituem as implementações TypeORM via jest.mock, compartilhando um "banco" único (db)
 * entre todas as rotas, como aconteceria com o PostgreSQL real.
 */
import { Client } from '../../domain/entities/Client';
import { Vehicle } from '../../domain/entities/Vehicle';
import { Part } from '../../domain/entities/Part';
import { Service } from '../../domain/entities/Service';
import { ServiceOrder } from '../../domain/entities/ServiceOrder';
import { User } from '../../domain/entities/User';
import { INACTIVE_STATUSES } from '../../domain/enums/ServiceOrderStatus';
import { IClientRepository, ListClientsOptions, PaginatedResult } from '../../domain/repositories/IClientRepository';
import { IVehicleRepository } from '../../domain/repositories/IVehicleRepository';
import { IPartRepository } from '../../domain/repositories/IPartRepository';
import { IServiceRepository } from '../../domain/repositories/IServiceRepository';
import { IServiceOrderRepository } from '../../domain/repositories/IServiceOrderRepository';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { ServiceOrderSaga, SagaStatus } from '../../domain/saga/ServiceOrderSaga';
import { ISagaUnitOfWork, OutgoingMessage, SagaTransactionContext } from '../../application/saga/ports';

export const db = {
  clients: new Map<string, Client>(),
  vehicles: new Map<string, Vehicle>(),
  parts: new Map<string, Part>(),
  services: new Map<string, Service>(),
  orders: new Map<string, ServiceOrder>(),
  users: new Map<string, User>(),
  sagas: new Map<string, ServiceOrderSaga>(),
  processed: new Map<string, string>(),
};

/** Mensagens gravadas no outbox (em ordem). */
export const outbox: OutgoingMessage[] = [];

export function resetDb(): void {
  Object.values(db).forEach((m) => m.clear());
  outbox.length = 0;
}

export class InMemoryClientRepository implements IClientRepository {
  constructor(_dataSource?: unknown) {}

  private alive(c?: Client): Client | null {
    return c && !c.deletedAt ? c : null;
  }

  async findById(id: string) {
    return this.alive(db.clients.get(id));
  }
  async findByCpfCnpj(cpfCnpj: string) {
    return this.alive([...db.clients.values()].find((c) => c.cpfCnpj === cpfCnpj));
  }
  async findByEmail(email: string) {
    return this.alive([...db.clients.values()].find((c) => c.email === email));
  }
  async findAll(options: ListClientsOptions): Promise<PaginatedResult<Client>> {
    const filtered = [...db.clients.values()]
      .filter((c) => !c.deletedAt)
      .filter((c) => !options.name || c.name.toLowerCase().includes(options.name.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
    const start = (options.page - 1) * options.limit;
    return { data: filtered.slice(start, start + options.limit), total: filtered.length, page: options.page, limit: options.limit };
  }
  async save(client: Client) {
    db.clients.set(client.id, client);
    return client;
  }
  async update(client: Client) {
    return this.save(client);
  }
  async softDelete(id: string) {
    const c = db.clients.get(id);
    if (c) c.deletedAt = new Date();
  }
}

export class InMemoryVehicleRepository implements IVehicleRepository {
  constructor(_dataSource?: unknown) {}
  async findById(id: string) {
    return db.vehicles.get(id) ?? null;
  }
  async findByPlate(plate: string) {
    return [...db.vehicles.values()].find((v) => v.plate === plate) ?? null;
  }
  async findByClientId(clientId: string) {
    return [...db.vehicles.values()].filter((v) => v.clientId === clientId);
  }
  async findAll() {
    return [...db.vehicles.values()];
  }
  async save(vehicle: Vehicle) {
    db.vehicles.set(vehicle.id, vehicle);
    return vehicle;
  }
  async update(vehicle: Vehicle) {
    return this.save(vehicle);
  }
  async delete(id: string) {
    db.vehicles.delete(id);
  }
}

export class InMemoryPartRepository implements IPartRepository {
  constructor(_dataSource?: unknown) {}
  async findById(id: string) {
    return db.parts.get(id) ?? null;
  }
  async findAll() {
    return [...db.parts.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  async save(part: Part) {
    db.parts.set(part.id, part);
    return part;
  }
  async update(part: Part) {
    return this.save(part);
  }
  async delete(id: string) {
    db.parts.delete(id);
  }
}

export class InMemoryServiceRepository implements IServiceRepository {
  constructor(_dataSource?: unknown) {}
  async findById(id: string) {
    return db.services.get(id) ?? null;
  }
  async findByIds(ids: string[]) {
    return ids.map((id) => db.services.get(id)).filter((s): s is Service => Boolean(s));
  }
  async findAll() {
    return [...db.services.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  async save(service: Service) {
    db.services.set(service.id, service);
    return service;
  }
  async update(service: Service) {
    return this.save(service);
  }
  async delete(id: string) {
    db.services.delete(id);
  }
}

export class InMemoryServiceOrderRepository implements IServiceOrderRepository {
  constructor(_dataSource?: unknown) {}
  async findById(id: string) {
    const o = db.orders.get(id);
    return o && !o.deletedAt ? o : null;
  }
  async findAll() {
    return [...db.orders.values()].filter((o) => !o.deletedAt);
  }
  async findActiveOrdered() {
    return (await this.findAll())
      .filter((o) => !INACTIVE_STATUSES.includes(o.status))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  async getNextOrderNumber() {
    return `OS-${new Date().getFullYear()}-${String(db.orders.size + 1).padStart(3, '0')}`;
  }
  async save(order: ServiceOrder) {
    db.orders.set(order.id, order);
    return order;
  }
  async update(order: ServiceOrder) {
    return this.save(order);
  }
  async softDelete(id: string) {
    const o = db.orders.get(id);
    if (o) o.deletedAt = new Date();
  }
}

export class InMemoryUserRepository implements IUserRepository {
  constructor(_dataSource?: unknown) {}
  async findById(id: string) {
    return db.users.get(id) ?? null;
  }
  async findByEmail(email: string) {
    return [...db.users.values()].find((u) => u.email === email) ?? null;
  }
  async save(user: User) {
    db.users.set(user.id, user);
    return user;
  }
}

/**
 * Unidade de trabalho em memória: aplica as gravações só se o trabalho terminar sem erro,
 * imitando o rollback da transação do PostgreSQL.
 */
export class InMemorySagaUnitOfWork implements ISagaUnitOfWork {
  constructor(_dataSource?: unknown) {}

  async run<T>(work: (ctx: SagaTransactionContext) => Promise<T>): Promise<T> {
    const sagaWrites = new Map<string, ServiceOrderSaga>();
    const orderWrites = new Map<string, ServiceOrder>();
    const outboxWrites: OutgoingMessage[] = [];
    const processedWrites = new Map<string, string>();
    const clone = (s: ServiceOrderSaga) =>
      new ServiceOrderSaga({ ...s, history: [...s.history], pendingCompensations: [...s.pendingCompensations] });

    const ctx: SagaTransactionContext = {
      sagas: {
        findById: async (id) => {
          const s = sagaWrites.get(id) ?? db.sagas.get(id);
          return s ? clone(s) : null;
        },
        findByServiceOrderId: async (osId) => {
          const s = [...sagaWrites.values(), ...db.sagas.values()].find((x) => x.serviceOrderId === osId);
          return s ? clone(s) : null;
        },
        findExpiredAwaitingApproval: async (now) =>
          [...db.sagas.values()]
            .filter((s) => s.status === SagaStatus.AGUARDANDO_APROVACAO && s.approvalDeadline && s.approvalDeadline <= now)
            .map(clone),
        save: async (saga) => {
          sagaWrites.set(saga.id, clone(saga));
          return saga;
        },
      },
      orders: {
        ...new InMemoryServiceOrderRepository(),
        findById: async (id) => orderWrites.get(id) ?? (await new InMemoryServiceOrderRepository().findById(id)),
        update: async (order) => {
          orderWrites.set(order.id, order);
          return order;
        },
      } as InMemoryServiceOrderRepository,
      outbox: { enqueue: async (m) => void outboxWrites.push(m) },
      inbox: {
        has: async (id) => processedWrites.has(id) || db.processed.has(id),
        mark: async (id, type) => void processedWrites.set(id, type),
      },
    };

    const result = await work(ctx);
    sagaWrites.forEach((s, id) => db.sagas.set(id, s));
    orderWrites.forEach((o, id) => db.orders.set(id, o));
    outbox.push(...outboxWrites);
    processedWrites.forEach((v, id) => db.processed.set(id, v));
    return result;
  }
}
