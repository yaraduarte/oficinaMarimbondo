import { DataSource, Repository } from 'typeorm';
import { VehicleEntity } from '../entities/VehicleEntity';
import { IVehicleRepository } from '../../../domain/repositories/IVehicleRepository';
import { Vehicle } from '../../../domain/entities/Vehicle';

function toDomain(entity: VehicleEntity): Vehicle {
  return new Vehicle({
    id: entity.id,
    plate: entity.plate,
    brand: entity.brand,
    model: entity.model,
    year: entity.year,
    clientId: entity.clientId,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  });
}

export class TypeORMVehicleRepository implements IVehicleRepository {
  private readonly repo: Repository<VehicleEntity>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(VehicleEntity);
  }

  async findById(id: string): Promise<Vehicle | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? toDomain(entity) : null;
  }

  async findByPlate(plate: string): Promise<Vehicle | null> {
    const entity = await this.repo.findOne({ where: { plate } });
    return entity ? toDomain(entity) : null;
  }

  async findByClientId(clientId: string): Promise<Vehicle[]> {
    const entities = await this.repo.find({ where: { clientId } });
    return entities.map(toDomain);
  }

  async findAll(): Promise<Vehicle[]> {
    const entities = await this.repo.find();
    return entities.map(toDomain);
  }

  async save(vehicle: Vehicle): Promise<Vehicle> {
    const entity = new VehicleEntity();
    Object.assign(entity, vehicle);
    const saved = await this.repo.save(entity);
    return toDomain(saved);
  }

  async update(vehicle: Vehicle): Promise<Vehicle> {
    const entity = new VehicleEntity();
    Object.assign(entity, vehicle);
    const saved = await this.repo.save(entity);
    return toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
