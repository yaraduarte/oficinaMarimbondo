import { DataSource, Repository } from 'typeorm';
import { ClientEntity } from '../entities/ClientEntity';
import { IClientRepository, ListClientsOptions, PaginatedResult } from '../../../domain/repositories/IClientRepository';
import { Client } from '../../../domain/entities/Client';

function toEntity(client: Client): ClientEntity {
  const entity = new ClientEntity();
  Object.assign(entity, client);
  return entity;
}

function toDomain(entity: ClientEntity): Client {
  return new Client({
    id: entity.id,
    name: entity.name,
    cpfCnpj: entity.cpfCnpj,
    email: entity.email,
    phone: entity.phone,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt ?? null,
  });
}

export class TypeORMClientRepository implements IClientRepository {
  private readonly repo: Repository<ClientEntity>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(ClientEntity);
  }

  async findById(id: string): Promise<Client | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? toDomain(entity) : null;
  }

  async findByCpfCnpj(cpfCnpj: string): Promise<Client | null> {
    const entity = await this.repo.findOne({ where: { cpfCnpj } });
    return entity ? toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<Client | null> {
    const entity = await this.repo.findOne({ where: { email } });
    return entity ? toDomain(entity) : null;
  }

  async findAll(options: ListClientsOptions): Promise<PaginatedResult<Client>> {
    const qb = this.repo.createQueryBuilder('client').withDeleted().where('client.deleted_at IS NULL');

    if (options.name) {
      qb.andWhere('LOWER(client.name) LIKE :name', { name: `%${options.name.toLowerCase()}%` });
    }

    const total = await qb.getCount();
    const entities = await qb
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .orderBy('client.name', 'ASC')
      .getMany();

    return {
      data: entities.map(toDomain),
      total,
      page: options.page,
      limit: options.limit,
    };
  }

  async save(client: Client): Promise<Client> {
    const entity = toEntity(client);
    const saved = await this.repo.save(entity);
    return toDomain(saved);
  }

  async update(client: Client): Promise<Client> {
    const entity = toEntity(client);
    const saved = await this.repo.save(entity);
    return toDomain(saved);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
