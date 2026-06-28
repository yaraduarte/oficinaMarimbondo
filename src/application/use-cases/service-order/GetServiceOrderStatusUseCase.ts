import { IServiceOrderRepository } from '../../../domain/repositories/IServiceOrderRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { AppError } from '../../../shared/errors/AppError';

export class GetServiceOrderStatusUseCase {
  constructor(private readonly serviceOrderRepository: IServiceOrderRepository) {}

  async execute(id: string): Promise<{ order: ServiceOrder; statusHistory: string[] }> {
    const order = await this.serviceOrderRepository.findById(id);
    if (!order) {
      throw new AppError('Ordem de serviço não encontrada', 404);
    }

    // Status history is inferred from current state (could be extended with an audit table)
    const statusHistory = [order.status];

    return { order, statusHistory };
  }
}
