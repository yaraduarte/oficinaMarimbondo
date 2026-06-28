import { IServiceOrderRepository } from '../../../domain/repositories/IServiceOrderRepository';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { ServiceOrderStatus } from '../../../domain/enums/ServiceOrderStatus';
import { IEmailService } from '../../../infrastructure/email/IEmailService';
import { ApproveQuoteDTO } from '../../dtos/ServiceOrderDTOs';
import { AppError } from '../../../shared/errors/AppError';

export class ApproveQuoteUseCase {
  constructor(
    private readonly serviceOrderRepository: IServiceOrderRepository,
    private readonly clientRepository: IClientRepository,
    private readonly emailService: IEmailService,
  ) {}

  async execute(id: string, dto: ApproveQuoteDTO): Promise<ServiceOrder> {
    const order = await this.serviceOrderRepository.findById(id);
    if (!order) {
      throw new AppError('Ordem de serviço não encontrada', 404);
    }

    if (order.status !== ServiceOrderStatus.AGUARDANDO_APROVACAO) {
      throw new AppError(
        `Apenas ordens com status AGUARDANDO_APROVACAO podem ser aprovadas/rejeitadas. Status atual: ${order.status}`,
        422,
      );
    }

    if (dto.decision === 'approved') {
      order.status = ServiceOrderStatus.EM_EXECUCAO;
      order.approvedAt = new Date();
    } else {
      order.status = ServiceOrderStatus.FINALIZADA;
    }

    order.updatedAt = new Date();
    const updated = await this.serviceOrderRepository.update(order);

    // Send email notification to client
    const client = await this.clientRepository.findById(order.clientId);
    if (client) {
      const subject =
        dto.decision === 'approved'
          ? `OS ${order.orderNumber} - Orçamento Aprovado`
          : `OS ${order.orderNumber} - Orçamento Rejeitado`;
      const text =
        dto.decision === 'approved'
          ? `Olá ${client.name}, o orçamento da sua ordem de serviço ${order.orderNumber} foi aprovado. Os serviços serão iniciados em breve.`
          : `Olá ${client.name}, o orçamento da sua ordem de serviço ${order.orderNumber} foi rejeitado. Entre em contato conosco para mais informações.`;

      await this.emailService.send({
        to: client.email,
        subject,
        text,
      });
    }

    return updated;
  }
}
