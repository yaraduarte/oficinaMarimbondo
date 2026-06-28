import { ListServiceOrdersUseCase } from '../../../application/use-cases/service-order/ListServiceOrdersUseCase';
import { ServiceOrderStatus } from '../../../domain/enums/ServiceOrderStatus';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { IServiceOrderRepository } from '../../../domain/repositories/IServiceOrderRepository';

function makeOrder(id: string, status: ServiceOrderStatus, createdAt: Date): ServiceOrder {
  return new ServiceOrder({
    id,
    orderNumber: `OS-2024-00${id}`,
    status,
    clientId: 'client-1',
    vehicleId: 'vehicle-1',
    services: [],
    parts: [],
    budget: 100,
    notes: null,
    approvedAt: null,
    createdAt,
    updatedAt: new Date(),
    deletedAt: null,
  });
}

describe('ListServiceOrdersUseCase', () => {
  let mockRepo: jest.Mocked<IServiceOrderRepository>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findActiveOrdered: jest.fn(),
      getNextOrderNumber: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };
  });

  it('deve excluir FINALIZADA e ENTREGUE da listagem', async () => {
    const orders = [
      makeOrder('1', ServiceOrderStatus.RECEBIDA, new Date('2024-01-01')),
      makeOrder('2', ServiceOrderStatus.FINALIZADA, new Date('2024-01-02')),
      makeOrder('3', ServiceOrderStatus.ENTREGUE, new Date('2024-01-03')),
      makeOrder('4', ServiceOrderStatus.EM_EXECUCAO, new Date('2024-01-04')),
    ];
    mockRepo.findActiveOrdered.mockResolvedValue(orders);

    const useCase = new ListServiceOrdersUseCase(mockRepo);
    const result = await useCase.execute();

    expect(result.some((o) => o.status === ServiceOrderStatus.FINALIZADA)).toBe(false);
    expect(result.some((o) => o.status === ServiceOrderStatus.ENTREGUE)).toBe(false);
    expect(result).toHaveLength(2);
  });

  it('deve ordenar por prioridade: EM_EXECUCAO antes de AGUARDANDO_APROVACAO antes de EM_DIAGNOSTICO antes de RECEBIDA', async () => {
    const orders = [
      makeOrder('1', ServiceOrderStatus.RECEBIDA, new Date('2024-01-01')),
      makeOrder('2', ServiceOrderStatus.EM_DIAGNOSTICO, new Date('2024-01-02')),
      makeOrder('3', ServiceOrderStatus.AGUARDANDO_APROVACAO, new Date('2024-01-03')),
      makeOrder('4', ServiceOrderStatus.EM_EXECUCAO, new Date('2024-01-04')),
    ];
    mockRepo.findActiveOrdered.mockResolvedValue(orders);

    const useCase = new ListServiceOrdersUseCase(mockRepo);
    const result = await useCase.execute();

    expect(result[0].status).toBe(ServiceOrderStatus.EM_EXECUCAO);
    expect(result[1].status).toBe(ServiceOrderStatus.AGUARDANDO_APROVACAO);
    expect(result[2].status).toBe(ServiceOrderStatus.EM_DIAGNOSTICO);
    expect(result[3].status).toBe(ServiceOrderStatus.RECEBIDA);
  });

  it('deve ordenar pelo mais antigo primeiro dentro do mesmo status', async () => {
    const orders = [
      makeOrder('1', ServiceOrderStatus.RECEBIDA, new Date('2024-03-01')),
      makeOrder('2', ServiceOrderStatus.RECEBIDA, new Date('2024-01-01')),
      makeOrder('3', ServiceOrderStatus.RECEBIDA, new Date('2024-02-01')),
    ];
    mockRepo.findActiveOrdered.mockResolvedValue(orders);

    const useCase = new ListServiceOrdersUseCase(mockRepo);
    const result = await useCase.execute();

    expect(result[0].id).toBe('2'); // Jan (oldest)
    expect(result[1].id).toBe('3'); // Feb
    expect(result[2].id).toBe('1'); // Mar (newest)
  });

  it('deve retornar lista vazia quando não há OS ativas', async () => {
    mockRepo.findActiveOrdered.mockResolvedValue([]);

    const useCase = new ListServiceOrdersUseCase(mockRepo);
    const result = await useCase.execute();

    expect(result).toHaveLength(0);
  });
});
