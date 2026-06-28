import { IServiceOrderRepository } from '../../../domain/repositories/IServiceOrderRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { ServiceOrderStatus, STATUS_PRIORITY } from '../../../domain/enums/ServiceOrderStatus';

export class ListServiceOrdersUseCase {
  constructor(private readonly serviceOrderRepository: IServiceOrderRepository) {}

  async execute(): Promise<ServiceOrder[]> {
    // Repository returns only active orders (excludes FINALIZADA and ENTREGUE)
    const orders = await this.serviceOrderRepository.findActiveOrdered();

    // Sort by status priority (EM_EXECUCAO=1, AGUARDANDO_APROVACAO=2, EM_DIAGNOSTICO=3, RECEBIDA=4)
    // then oldest first within same status
    return orders
      .filter(
        (o) =>
          o.status !== ServiceOrderStatus.FINALIZADA && o.status !== ServiceOrderStatus.ENTREGUE,
      )
      .sort((a, b) => {
        const priorityA = STATUS_PRIORITY[a.status] ?? 99;
        const priorityB = STATUS_PRIORITY[b.status] ?? 99;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }
}
