import { IServiceOrderRepository } from '../../../domain/repositories/IServiceOrderRepository';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { ServiceOrderStatus } from '../../../domain/enums/ServiceOrderStatus';
import { INotificationService } from '../../../infrastructure/notification/INotificationService';
import { UpdateServiceOrderStatusDTO } from '../../dtos/ServiceOrderDTOs';
import { AppError } from '../../../shared/errors/AppError';

const STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  [ServiceOrderStatus.RECEBIDA]: 'Recebida',
  [ServiceOrderStatus.EM_DIAGNOSTICO]: 'Em Diagnóstico',
  [ServiceOrderStatus.AGUARDANDO_APROVACAO]: 'Aguardando Aprovação',
  [ServiceOrderStatus.EM_EXECUCAO]: 'Em Execução',
  [ServiceOrderStatus.FINALIZADA]: 'Finalizada',
  [ServiceOrderStatus.ENTREGUE]: 'Entregue',
};

const STATUS_MESSAGES: Record<ServiceOrderStatus, string> = {
  [ServiceOrderStatus.RECEBIDA]: 'Sua ordem de serviço foi recebida e será analisada em breve.',
  [ServiceOrderStatus.EM_DIAGNOSTICO]: 'Nossos mecânicos estão realizando o diagnóstico do seu veículo.',
  [ServiceOrderStatus.AGUARDANDO_APROVACAO]: 'O orçamento foi preparado e aguarda sua aprovação.',
  [ServiceOrderStatus.EM_EXECUCAO]: 'Os serviços estão sendo executados no seu veículo.',
  [ServiceOrderStatus.FINALIZADA]: 'Os serviços foram concluídos. Seu veículo está pronto para retirada!',
  [ServiceOrderStatus.ENTREGUE]: 'Veículo entregue. Obrigado pela preferência!',
};

export class UpdateServiceOrderStatusUseCase {
  constructor(
    private readonly serviceOrderRepository: IServiceOrderRepository,
    private readonly clientRepository: IClientRepository,
    private readonly notificationService: INotificationService,
  ) {}

  async execute(id: string, dto: UpdateServiceOrderStatusDTO): Promise<ServiceOrder> {
    const order = await this.serviceOrderRepository.findById(id);
    if (!order) throw new AppError('Ordem de serviço não encontrada', 404);

    if (!order.canTransitionTo(dto.status)) {
      throw new AppError(`Transição inválida: ${order.status} → ${dto.status}`, 422);
    }

    order.status = dto.status;
    order.updatedAt = new Date();
    const updated = await this.serviceOrderRepository.update(order);

    const client = await this.clientRepository.findById(order.clientId);
    if (client) {
      await this.notificationService.sendStatusUpdate({
        clientName: client.name,
        clientEmail: client.email,
        clientPhone: client.phone,
        orderNumber: order.orderNumber,
        newStatus: STATUS_LABELS[dto.status],
        message: STATUS_MESSAGES[dto.status],
      });
    }

    return updated;
  }
}
