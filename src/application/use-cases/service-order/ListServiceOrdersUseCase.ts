import { IServiceOrderRepository } from '../../../domain/repositories/IServiceOrderRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { INACTIVE_STATUSES, STATUS_PRIORITY } from '../../../domain/enums/ServiceOrderStatus';

export class ListServiceOrdersUseCase {
  constructor(private readonly serviceOrderRepository: IServiceOrderRepository) {}

  async execute(): Promise<ServiceOrder[]> {
    // Repository returns only active orders (excludes FINALIZADA, ENTREGUE and CANCELADA)
    const orders = await this.serviceOrderRepository.findActiveOrdered();

    // Sort by status priority (ver STATUS_PRIORITY: EM_EXECUCAO primeiro, RECEBIDA por último)
    // then oldest first within same status
    return orders
      .filter((o) => !INACTIVE_STATUSES.includes(o.status))
      .sort((a, b) => {
        const priorityA = STATUS_PRIORITY[a.status] ?? 99;
        const priorityB = STATUS_PRIORITY[b.status] ?? 99;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }
}
