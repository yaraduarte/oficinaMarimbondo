import { ServiceOrder } from '../entities/ServiceOrder';

export interface IServiceOrderRepository {
  findById(id: string): Promise<ServiceOrder | null>;
  findAll(): Promise<ServiceOrder[]>;
  findActiveOrdered(): Promise<ServiceOrder[]>;
  getNextOrderNumber(): Promise<string>;
  save(order: ServiceOrder): Promise<ServiceOrder>;
  update(order: ServiceOrder): Promise<ServiceOrder>;
  softDelete(id: string): Promise<void>;
}
