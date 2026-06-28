import { DataSource, Not, In, Repository } from 'typeorm';
import { ServiceOrderEntity } from '../entities/ServiceOrderEntity';
import { IServiceOrderRepository } from '../../../domain/repositories/IServiceOrderRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { ServiceOrderStatus } from '../../../domain/enums/ServiceOrderStatus';

function toDomain(entity: ServiceOrderEntity): ServiceOrder {
  return new ServiceOrder({
    id: entity.id,
    orderNumber: entity.orderNumber,
    status: entity.status,
    clientId: entity.clientId,
    vehicleId: entity.vehicleId,
    services: entity.services,
    parts: entity.parts,
    budget: Number(entity.budget),
    notes: entity.notes,
    approvedAt: entity.approvedAt,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt,
  });
}

export class TypeORMServiceOrderRepository implements IServiceOrderRepository {
  private readonly repo: Repository<ServiceOrderEntity>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(ServiceOrderEntity);
  }

  async findById(id: string): Promise<ServiceOrder | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? toDomain(entity) : null;
  }

  async findAll(): Promise<ServiceOrder[]> {
    const entities = await this.repo.find({ order: { createdAt: 'DESC' } });
    return entities.map(toDomain);
  }

  async findActiveOrdered(): Promise<ServiceOrder[]> {
    const entities = await this.repo.find({
      where: {
        status: Not(In([ServiceOrderStatus.FINALIZADA, ServiceOrderStatus.ENTREGUE])),
      },
      order: { createdAt: 'ASC' },
    });
    return entities.map(toDomain);
  }

  async getNextOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.repo
      .createQueryBuilder('so')
      .withDeleted()
      .where("so.order_number LIKE :pattern", { pattern: `OS-${year}-%` })
      .getCount();
    const seq = String(count + 1).padStart(3, '0');
    return `OS-${year}-${seq}`;
  }

  async save(order: ServiceOrder): Promise<ServiceOrder> {
    const entity = new ServiceOrderEntity();
    Object.assign(entity, order);
    const saved = await this.repo.save(entity);
    return toDomain(saved);
  }

  async update(order: ServiceOrder): Promise<ServiceOrder> {
    const entity = new ServiceOrderEntity();
    Object.assign(entity, order);
    const saved = await this.repo.save(entity);
    return toDomain(saved);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
