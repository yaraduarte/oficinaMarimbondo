import { ApproveQuoteUseCase } from '../../../application/use-cases/service-order/ApproveQuoteUseCase';
import { ServiceOrderStatus } from '../../../domain/enums/ServiceOrderStatus';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { Client } from '../../../domain/entities/Client';
import { IServiceOrderRepository } from '../../../domain/repositories/IServiceOrderRepository';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { IEmailService } from '../../../infrastructure/email/IEmailService';
import { AppError } from '../../../shared/errors/AppError';

function makeOrder(status: ServiceOrderStatus): ServiceOrder {
  return new ServiceOrder({
    id: 'order-1',
    orderNumber: 'OS-2024-001',
    status,
    clientId: 'client-1',
    vehicleId: 'vehicle-1',
    services: [{ serviceId: 's1', serviceName: 'Alinhamento', price: 100 }],
    parts: [],
    budget: 100,
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
    name: 'Maria',
    cpfCnpj: '11144477735',
    email: 'maria@email.com',
    phone: '11999999999',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });
}

describe('ApproveQuoteUseCase', () => {
  let mockOrderRepo: jest.Mocked<IServiceOrderRepository>;
  let mockClientRepo: jest.Mocked<IClientRepository>;
  let mockEmailService: jest.Mocked<IEmailService>;

  beforeEach(() => {
    mockOrderRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findActiveOrdered: jest.fn(),
      getNextOrderNumber: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };
    mockClientRepo = {
      findById: jest.fn(),
      findByCpfCnpj: jest.fn(),
      findByEmail: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };
    mockEmailService = {
      send: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('deve mudar status para EM_EXECUCAO quando aprovado', async () => {
    const order = makeOrder(ServiceOrderStatus.AGUARDANDO_APROVACAO);
    mockOrderRepo.findById.mockResolvedValue(order);
    mockOrderRepo.update.mockImplementation(async (o) => o);
    mockClientRepo.findById.mockResolvedValue(makeClient());

    const useCase = new ApproveQuoteUseCase(mockOrderRepo, mockClientRepo, mockEmailService);
    const result = await useCase.execute('order-1', { decision: 'approved' });

    expect(result.status).toBe(ServiceOrderStatus.EM_EXECUCAO);
    expect(result.approvedAt).not.toBeNull();
    expect(mockEmailService.send).toHaveBeenCalledTimes(1);
  });

  it('deve mudar status para FINALIZADA quando rejeitado', async () => {
    const order = makeOrder(ServiceOrderStatus.AGUARDANDO_APROVACAO);
    mockOrderRepo.findById.mockResolvedValue(order);
    mockOrderRepo.update.mockImplementation(async (o) => o);
    mockClientRepo.findById.mockResolvedValue(makeClient());

    const useCase = new ApproveQuoteUseCase(mockOrderRepo, mockClientRepo, mockEmailService);
    const result = await useCase.execute('order-1', { decision: 'rejected' });

    expect(result.status).toBe(ServiceOrderStatus.FINALIZADA);
    expect(result.approvedAt).toBeNull();
  });

  it('deve lançar erro se OS não estiver em AGUARDANDO_APROVACAO', async () => {
    const order = makeOrder(ServiceOrderStatus.RECEBIDA);
    mockOrderRepo.findById.mockResolvedValue(order);

    const useCase = new ApproveQuoteUseCase(mockOrderRepo, mockClientRepo, mockEmailService);

    await expect(useCase.execute('order-1', { decision: 'approved' })).rejects.toThrow(AppError);
  });

  it('deve lançar erro se OS não encontrada', async () => {
    mockOrderRepo.findById.mockResolvedValue(null);

    const useCase = new ApproveQuoteUseCase(mockOrderRepo, mockClientRepo, mockEmailService);

    await expect(useCase.execute('invalid-id', { decision: 'approved' })).rejects.toThrow(AppError);
  });
});
