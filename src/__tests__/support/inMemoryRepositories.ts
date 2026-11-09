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
import { ServiceOrderStatus } from '../../domain/enums/ServiceOrderStatus';
import { IClientRepository, ListClientsOptions, PaginatedResult } from '../../domain/repositories/IClientRepository';
import { IVehicleRepository } from '../../domain/repositories/IVehicleRepository';
import { IPartRepository } from '../../domain/repositories/IPartRepository';
import { IServiceRepository } from '../../domain/repositories/IServiceRepository';
import { IServiceOrderRepository } from '../../domain/repositories/IServiceOrderRepository';
import { IUserRepository } from '../../domain/repositories/IUserRepository';

export const db = {
  clients: new Map<string, Client>(),
  vehicles: new Map<string, Vehicle>(),
  parts: new Map<string, Part>(),
  services: new Map<string, Service>(),
  orders: new Map<string, ServiceOrder>(),
  users: new Map<string, User>(),
};

export function resetDb(): void {
  Object.values(db).forEach((m) => m.clear());
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
    const done = [ServiceOrderStatus.FINALIZADA, ServiceOrderStatus.ENTREGUE];
    return (await this.findAll())
      .filter((o) => !done.includes(o.status))
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
