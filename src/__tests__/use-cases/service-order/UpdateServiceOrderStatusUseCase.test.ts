import { UpdateServiceOrderStatusUseCase } from '../../../application/use-cases/service-order/UpdateServiceOrderStatusUseCase';
import { IServiceOrderRepository } from '../../../domain/repositories/IServiceOrderRepository';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { INotificationService } from '../../../infrastructure/notification/INotificationService';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { Client } from '../../../domain/entities/Client';
import { ServiceOrderStatus } from '../../../domain/enums/ServiceOrderStatus';
import { AppError } from '../../../shared/errors/AppError';

function makeOrderRepo(): jest.Mocked<IServiceOrderRepository> {
  return {
    findById: jest.fn(),
    findAll: jest.fn(),
    findActiveOrdered: jest.fn(),
    getNextOrderNumber: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };
}

function makeClientRepo(): jest.Mocked<IClientRepository> {
  return {
    findById: jest.fn(),
    findByCpfCnpj: jest.fn(),
    findByEmail: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };
}

function makeOrder(status: ServiceOrderStatus): ServiceOrder {
  return new ServiceOrder({
    id: 'order-1',
    orderNumber: 'OS-2024-001',
    status,
    clientId: 'client-1',
    vehicleId: 'vehicle-1',
    services: [],
    parts: [],
    budget: 200,
    notes: null,
    approvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });
}

function makeClient(): Client {
  return new Client({
    id: 'client-1',
    name: 'Pedro',
    cpfCnpj: '11144477735',
    email: 'pedro@email.com',
    phone: '11988887777',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });
}

describe('UpdateServiceOrderStatusUseCase', () => {
  let orderRepo: jest.Mocked<IServiceOrderRepository>;
  let clientRepo: jest.Mocked<IClientRepository>;
  let notification: jest.Mocked<INotificationService>;

  beforeEach(() => {
    orderRepo = makeOrderRepo();
    clientRepo = makeClientRepo();
    notification = { sendStatusUpdate: jest.fn().mockResolvedValue(undefined) };
  });

  it('deve avançar status de RECEBIDA para EM_DIAGNOSTICO', async () => {
    const order = makeOrder(ServiceOrderStatus.RECEBIDA);
    orderRepo.findById.mockResolvedValue(order);
    orderRepo.update.mockImplementation(async (o) => o);
    clientRepo.findById.mockResolvedValue(makeClient());

    const useCase = new UpdateServiceOrderStatusUseCase(orderRepo, clientRepo, notification);
    const result = await useCase.execute('order-1', { status: ServiceOrderStatus.EM_DIAGNOSTICO });

    expect(result.status).toBe(ServiceOrderStatus.EM_DIAGNOSTICO);
    expect(orderRepo.update).toHaveBeenCalledTimes(1);
  });

  it('deve enviar notificação com status e nome corretos', async () => {
    const order = makeOrder(ServiceOrderStatus.RECEBIDA);
    orderRepo.findById.mockResolvedValue(order);
    orderRepo.update.mockImplementation(async (o) => o);
    clientRepo.findById.mockResolvedValue(makeClient());

    const useCase = new UpdateServiceOrderStatusUseCase(orderRepo, clientRepo, notification);
    await useCase.execute('order-1', { status: ServiceOrderStatus.EM_DIAGNOSTICO });

    expect(notification.sendStatusUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: 'Pedro',
        orderNumber: 'OS-2024-001',
        newStatus: 'Em Diagnóstico',
      }),
    );
  });

  it('deve lançar AppError 404 quando OS não encontrada', async () => {
    orderRepo.findById.mockResolvedValue(null);

    const useCase = new UpdateServiceOrderStatusUseCase(orderRepo, clientRepo, notification);

    await expect(
      useCase.execute('id-invalido', { status: ServiceOrderStatus.EM_DIAGNOSTICO }),
    ).rejects.toThrow(new AppError('Ordem de serviço não encontrada', 404));
  });

  it('deve lançar AppError 422 para transição de status inválida', async () => {
    const order = makeOrder(ServiceOrderStatus.RECEBIDA);
    orderRepo.findById.mockResolvedValue(order);

    const useCase = new UpdateServiceOrderStatusUseCase(orderRepo, clientRepo, notification);

    await expect(
      useCase.execute('order-1', { status: ServiceOrderStatus.ENTREGUE }),
    ).rejects.toThrow(AppError);
  });

  it('não deve lançar erro quando cliente não encontrado (apenas omite notificação)', async () => {
    const order = makeOrder(ServiceOrderStatus.RECEBIDA);
    orderRepo.findById.mockResolvedValue(order);
    orderRepo.update.mockImplementation(async (o) => o);
    clientRepo.findById.mockResolvedValue(null);

    const useCase = new UpdateServiceOrderStatusUseCase(orderRepo, clientRepo, notification);
    const result = await useCase.execute('order-1', { status: ServiceOrderStatus.EM_DIAGNOSTICO });

    expect(result.status).toBe(ServiceOrderStatus.EM_DIAGNOSTICO);
    expect(notification.sendStatusUpdate).not.toHaveBeenCalled();
  });

  it('deve avançar de EM_EXECUCAO para FINALIZADA', async () => {
    const order = makeOrder(ServiceOrderStatus.EM_EXECUCAO);
    orderRepo.findById.mockResolvedValue(order);
    orderRepo.update.mockImplementation(async (o) => o);
    clientRepo.findById.mockResolvedValue(makeClient());

    const useCase = new UpdateServiceOrderStatusUseCase(orderRepo, clientRepo, notification);
    const result = await useCase.execute('order-1', { status: ServiceOrderStatus.FINALIZADA });

    expect(result.status).toBe(ServiceOrderStatus.FINALIZADA);
  });
});
