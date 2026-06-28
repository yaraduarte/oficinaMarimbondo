import { DataSource, Repository } from 'typeorm';
import { PartEntity } from '../entities/PartEntity';
import { IPartRepository } from '../../../domain/repositories/IPartRepository';
import { Part } from '../../../domain/entities/Part';

function toDomain(entity: PartEntity): Part {
  return new Part({
    id: entity.id,
    name: entity.name,
    description: entity.description,
    unitPrice: Number(entity.unitPrice),
    stockQuantity: entity.stockQuantity,
    minStockAlert: entity.minStockAlert,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  });
}

export class TypeORMPartRepository implements IPartRepository {
  private readonly repo: Repository<PartEntity>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(PartEntity);
  }

  async findById(id: string): Promise<Part | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? toDomain(entity) : null;
  }

  async findAll(): Promise<Part[]> {
    const entities = await this.repo.find({ order: { name: 'ASC' } });
    return entities.map(toDomain);
  }

  async save(part: Part): Promise<Part> {
    const entity = new PartEntity();
    Object.assign(entity, part);
    const saved = await this.repo.save(entity);
    return toDomain(saved);
  }

  async update(part: Part): Promise<Part> {
    const entity = new PartEntity();
    Object.assign(entity, part);
    const saved = await this.repo.save(entity);
    return toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
