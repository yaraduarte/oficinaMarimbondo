import { CreateServiceOrderUseCase } from '../../../application/use-cases/service-order/CreateServiceOrderUseCase';
import { ServiceOrderStatus } from '../../../domain/enums/ServiceOrderStatus';
import { IServiceOrderRepository } from '../../../domain/repositories/IServiceOrderRepository';
import { IServiceRepository } from '../../../domain/repositories/IServiceRepository';
import { IPartRepository } from '../../../domain/repositories/IPartRepository';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { IVehicleRepository } from '../../../domain/repositories/IVehicleRepository';
import { Client } from '../../../domain/entities/Client';
import { Vehicle } from '../../../domain/entities/Vehicle';
import { Part } from '../../../domain/entities/Part';
import { Service } from '../../../domain/entities/Service';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { AppError } from '../../../shared/errors/AppError';

const makeClient = (): Client =>
  new Client({
    id: 'client-1',
    name: 'João Silva',
    cpfCnpj: '11144477735',
    email: 'joao@email.com',
    phone: '11999999999',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });

const makeVehicle = (): Vehicle =>
  new Vehicle({
    id: 'vehicle-1',
    plate: 'ABC1D23',
    brand: 'Fiat',
    model: 'Uno',
    year: 2020,
    clientId: 'client-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const makeService = (id: string, price: number): Service =>
  new Service({
    id,
    name: `Serviço ${id}`,
    description: 'Desc',
    price,
    estimatedHours: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const makePart = (id: string, unitPrice: number, stock = 10): Part =>
  new Part({
    id,
    name: `Peça ${id}`,
    description: 'Desc',
    unitPrice,
    stockQuantity: stock,
    minStockAlert: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

function makeMockRepos() {
  const clientRepository: jest.Mocked<IClientRepository> = {
    findById: jest.fn(),
    findByCpfCnpj: jest.fn(),
    findByEmail: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  const vehicleRepository: jest.Mocked<IVehicleRepository> = {
    findById: jest.fn(),
    findByPlate: jest.fn(),
    findByClientId: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const serviceRepository: jest.Mocked<IServiceRepository> = {
    findById: jest.fn(),
    findByIds: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const partRepository: jest.Mocked<IPartRepository> = {
    findById: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const serviceOrderRepository: jest.Mocked<IServiceOrderRepository> = {
    findById: jest.fn(),
    findAll: jest.fn(),
    findActiveOrdered: jest.fn(),
    getNextOrderNumber: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  return { clientRepository, vehicleRepository, serviceRepository, partRepository, serviceOrderRepository };
}

describe('CreateServiceOrderUseCase', () => {
  it('deve criar uma OS com status RECEBIDA e calcular orçamento corretamente', async () => {
    const { clientRepository, vehicleRepository, serviceRepository, partRepository, serviceOrderRepository } = makeMockRepos();

    clientRepository.findById.mockResolvedValue(makeClient());
    vehicleRepository.findById.mockResolvedValue(makeVehicle());
    serviceRepository.findByIds.mockResolvedValue([makeService('svc-1', 150), makeService('svc-2', 200)]);
    partRepository.findById.mockResolvedValue(makePart('part-1', 50, 10));
    serviceOrderRepository.getNextOrderNumber.mockResolvedValue('OS-2024-001');
    serviceOrderRepository.save.mockImplementation(async (o) => o);

    const useCase = new CreateServiceOrderUseCase(
      serviceOrderRepository,
      serviceRepository,
      partRepository,
      clientRepository,
      vehicleRepository,
    );

    const result = await useCase.execute({
      clientId: 'client-1',
      vehicleId: 'vehicle-1',
      serviceIds: ['svc-1', 'svc-2'],
      parts: [{ partId: 'part-1', quantity: 2 }],
      notes: 'Veículo arranhado',
    });

    expect(result.status).toBe(ServiceOrderStatus.RECEBIDA);
    expect(result.orderNumber).toBe('OS-2024-001');
    // budget = 150 + 200 (services) + 50 * 2 (parts) = 450
    expect(result.budget).toBe(450);
    expect(result.services).toHaveLength(2);
    expect(result.parts).toHaveLength(1);
  });

  it('deve lançar erro quando cliente não encontrado', async () => {
    const { clientRepository, vehicleRepository, serviceRepository, partRepository, serviceOrderRepository } = makeMockRepos();
    clientRepository.findById.mockResolvedValue(null);

    const useCase = new CreateServiceOrderUseCase(
      serviceOrderRepository, serviceRepository, partRepository, clientRepository, vehicleRepository,
    );

    await expect(useCase.execute({
      clientId: 'invalid-id',
      vehicleId: 'vehicle-1',
      serviceIds: ['svc-1'],
      parts: [],
    })).rejects.toThrow(AppError);
  });

  it('deve lançar erro quando veículo não pertence ao cliente', async () => {
    const { clientRepository, vehicleRepository, serviceRepository, partRepository, serviceOrderRepository } = makeMockRepos();

    clientRepository.findById.mockResolvedValue(makeClient());
    const vehicle = makeVehicle();
    vehicle.clientId = 'other-client';
    vehicleRepository.findById.mockResolvedValue(vehicle);

    const useCase = new CreateServiceOrderUseCase(
      serviceOrderRepository, serviceRepository, partRepository, clientRepository, vehicleRepository,
    );

    await expect(useCase.execute({
      clientId: 'client-1',
      vehicleId: 'vehicle-1',
      serviceIds: ['svc-1'],
      parts: [],
    })).rejects.toThrow(AppError);
  });

  it('deve lançar erro quando estoque insuficiente', async () => {
    const { clientRepository, vehicleRepository, serviceRepository, partRepository, serviceOrderRepository } = makeMockRepos();

    clientRepository.findById.mockResolvedValue(makeClient());
    vehicleRepository.findById.mockResolvedValue(makeVehicle());
    serviceRepository.findByIds.mockResolvedValue([makeService('svc-1', 100)]);
    partRepository.findById.mockResolvedValue(makePart('part-1', 50, 1)); // stock = 1, quantity = 5

    const useCase = new CreateServiceOrderUseCase(
      serviceOrderRepository, serviceRepository, partRepository, clientRepository, vehicleRepository,
    );

    await expect(useCase.execute({
      clientId: 'client-1',
      vehicleId: 'vehicle-1',
      serviceIds: ['svc-1'],
      parts: [{ partId: 'part-1', quantity: 5 }],
    })).rejects.toThrow(AppError);
  });
});
