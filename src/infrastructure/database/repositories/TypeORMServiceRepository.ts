import { DataSource, In, Repository } from 'typeorm';
import { ServiceEntity } from '../entities/ServiceEntity';
import { IServiceRepository } from '../../../domain/repositories/IServiceRepository';
import { Service } from '../../../domain/entities/Service';

function toDomain(entity: ServiceEntity): Service {
  return new Service({
    id: entity.id,
    name: entity.name,
    description: entity.description,
    price: Number(entity.price),
    estimatedHours: Number(entity.estimatedHours),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  });
}

export class TypeORMServiceRepository implements IServiceRepository {
  private readonly repo: Repository<ServiceEntity>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(ServiceEntity);
  }

  async findById(id: string): Promise<Service | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? toDomain(entity) : null;
  }

  async findByIds(ids: string[]): Promise<Service[]> {
    if (ids.length === 0) return [];
    const entities = await this.repo.findBy({ id: In(ids) });
    return entities.map(toDomain);
  }

  async findAll(): Promise<Service[]> {
    const entities = await this.repo.find({ order: { name: 'ASC' } });
    return entities.map(toDomain);
  }

  async save(service: Service): Promise<Service> {
    const entity = new ServiceEntity();
    Object.assign(entity, service);
    const saved = await this.repo.save(entity);
    return toDomain(saved);
  }

  async update(service: Service): Promise<Service> {
    const entity = new ServiceEntity();
    Object.assign(entity, service);
    const saved = await this.repo.save(entity);
    return toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
