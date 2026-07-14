import { IServiceOrderRepository } from '../../../domain/repositories/IServiceOrderRepository';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { ServiceOrderStatus } from '../../../domain/enums/ServiceOrderStatus';
import { INotificationService } from '../../../infrastructure/notification/INotificationService';
import { ApproveQuoteDTO } from '../../dtos/ServiceOrderDTOs';
import { AppError } from '../../../shared/errors/AppError';

export class ApproveQuoteUseCase {
  constructor(
    private readonly serviceOrderRepository: IServiceOrderRepository,
    private readonly clientRepository: IClientRepository,
    private readonly notificationService: INotificationService,
  ) {}

  async execute(id: string, dto: ApproveQuoteDTO): Promise<ServiceOrder> {
    const order = await this.serviceOrderRepository.findById(id);
    if (!order) throw new AppError('Ordem de serviço não encontrada', 404);

    if (order.status !== ServiceOrderStatus.AGUARDANDO_APROVACAO) {
      throw new AppError(
        `Apenas ordens com status AGUARDANDO_APROVACAO podem ser aprovadas/rejeitadas. Status atual: ${order.status}`,
        422,
      );
    }

    const approved = dto.decision === 'approved';
    order.status = approved ? ServiceOrderStatus.EM_EXECUCAO : ServiceOrderStatus.FINALIZADA;
    if (approved) order.approvedAt = new Date();
    order.updatedAt = new Date();

    const updated = await this.serviceOrderRepository.update(order);

    const client = await this.clientRepository.findById(order.clientId);
    if (client) {
      const message = approved
        ? `O orçamento da sua OS ${order.orderNumber} foi aprovado. Os serviços serão iniciados em breve!`
        : `O orçamento da sua OS ${order.orderNumber} foi recusado. Entre em contato para mais informações.`;

      await this.notificationService.sendStatusUpdate({
        clientName: client.name,
        clientEmail: client.email,
        clientPhone: client.phone,
        orderNumber: order.orderNumber,
        newStatus: approved ? 'Em Execução' : 'Finalizada',
        message,
      });
    }

    return updated;
  }
}
