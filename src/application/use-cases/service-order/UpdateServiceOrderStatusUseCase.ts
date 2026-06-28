import { IServiceOrderRepository } from '../../../domain/repositories/IServiceOrderRepository';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { ServiceOrderStatus } from '../../../domain/enums/ServiceOrderStatus';
import { IEmailService } from '../../../infrastructure/email/IEmailService';
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

export class UpdateServiceOrderStatusUseCase {
  constructor(
    private readonly serviceOrderRepository: IServiceOrderRepository,
    private readonly clientRepository: IClientRepository,
    private readonly emailService: IEmailService,
  ) {}

  async execute(id: string, dto: UpdateServiceOrderStatusDTO): Promise<ServiceOrder> {
    const order = await this.serviceOrderRepository.findById(id);
    if (!order) {
      throw new AppError('Ordem de serviço não encontrada', 404);
    }

    if (!order.canTransitionTo(dto.status)) {
      throw new AppError(
        `Transição inválida: ${order.status} → ${dto.status}`,
        422,
      );
    }

    order.status = dto.status;
    order.updatedAt = new Date();
    const updated = await this.serviceOrderRepository.update(order);

    // Send email notification to client
    const client = await this.clientRepository.findById(order.clientId);
    if (client) {
      const statusLabel = STATUS_LABELS[dto.status];
      await this.emailService.send({
        to: client.email,
        subject: `OS ${order.orderNumber} - Status atualizado`,
        text: `Olá ${client.name}, o status da sua ordem de serviço ${order.orderNumber} foi atualizado para: ${statusLabel}.`,
      });
    }

    return updated;
  }
}
