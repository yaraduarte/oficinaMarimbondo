import { v4 as uuidv4 } from 'uuid';
import { IServiceOrderRepository } from '../../../domain/repositories/IServiceOrderRepository';
import { IServiceRepository } from '../../../domain/repositories/IServiceRepository';
import { IPartRepository } from '../../../domain/repositories/IPartRepository';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { IVehicleRepository } from '../../../domain/repositories/IVehicleRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { ServiceOrderStatus } from '../../../domain/enums/ServiceOrderStatus';
import { CreateServiceOrderDTO } from '../../dtos/ServiceOrderDTOs';
import { AppError } from '../../../shared/errors/AppError';

export class CreateServiceOrderUseCase {
  constructor(
    private readonly serviceOrderRepository: IServiceOrderRepository,
    private readonly serviceRepository: IServiceRepository,
    private readonly partRepository: IPartRepository,
    private readonly clientRepository: IClientRepository,
    private readonly vehicleRepository: IVehicleRepository,
  ) {}

  async execute(dto: CreateServiceOrderDTO): Promise<ServiceOrder> {
    const client = await this.clientRepository.findById(dto.clientId);
    if (!client) {
      throw new AppError('Cliente não encontrado', 404);
    }

    const vehicle = await this.vehicleRepository.findById(dto.vehicleId);
    if (!vehicle) {
      throw new AppError('Veículo não encontrado', 404);
    }
    if (vehicle.clientId !== dto.clientId) {
      throw new AppError('Veículo não pertence ao cliente informado', 422);
    }

    const services = await this.serviceRepository.findByIds(dto.serviceIds);
    if (services.length !== dto.serviceIds.length) {
      throw new AppError('Um ou mais serviços não foram encontrados', 404);
    }

    const orderServices = services.map((s) => ({
      serviceId: s.id,
      serviceName: s.name,
      price: s.price,
    }));

    const orderParts = [];
    for (const item of dto.parts) {
      const part = await this.partRepository.findById(item.partId);
      if (!part) {
        throw new AppError(`Peça ${item.partId} não encontrada`, 404);
      }
      if (part.stockQuantity < item.quantity) {
        throw new AppError(`Estoque insuficiente para a peça: ${part.name}`, 422);
      }
      orderParts.push({
        partId: part.id,
        partName: part.name,
        quantity: item.quantity,
        unitPrice: part.unitPrice,
      });
    }

    const orderNumber = await this.serviceOrderRepository.getNextOrderNumber();

    const order = new ServiceOrder({
      id: uuidv4(),
      orderNumber,
      status: ServiceOrderStatus.RECEBIDA,
      clientId: dto.clientId,
      vehicleId: dto.vehicleId,
      services: orderServices,
      parts: orderParts,
      notes: dto.notes ?? null,
      approvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    order.budget = order.calculateBudget();

    return this.serviceOrderRepository.save(order);
  }
}
