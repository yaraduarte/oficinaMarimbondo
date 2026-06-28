import { Service } from '../entities/Service';

export interface IServiceRepository {
  findById(id: string): Promise<Service | null>;
  findByIds(ids: string[]): Promise<Service[]>;
  findAll(): Promise<Service[]>;
  save(service: Service): Promise<Service>;
  update(service: Service): Promise<Service>;
  delete(id: string): Promise<void>;
}
