import { CreateVehicleUseCase } from '../../../application/use-cases/vehicle/CreateVehicleUseCase';
import { IVehicleRepository } from '../../../domain/repositories/IVehicleRepository';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { Client } from '../../../domain/entities/Client';
import { Vehicle } from '../../../domain/entities/Vehicle';
import { AppError } from '../../../shared/errors/AppError';

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

function makeVehicleRepo(): jest.Mocked<IVehicleRepository> {
  return {
    findById: jest.fn(),
    findByPlate: jest.fn(),
    findByClientId: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

function makeClient(): Client {
  return new Client({
    id: 'client-1',
    name: 'João',
    cpfCnpj: '11144477735',
    email: 'joao@email.com',
    phone: '11999999999',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });
}

function makeVehicle(): Vehicle {
  return new Vehicle({
    id: 'vehicle-1',
    plate: 'ABC1D23',
    brand: 'Fiat',
    model: 'Uno',
    year: 2021,
    clientId: 'client-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('CreateVehicleUseCase', () => {
  it('deve criar veículo com placa Mercosul válida', async () => {
    const vehicleRepo = makeVehicleRepo();
    const clientRepo = makeClientRepo();
    clientRepo.findById.mockResolvedValue(makeClient());
    vehicleRepo.findByPlate.mockResolvedValue(null);
    vehicleRepo.save.mockImplementation(async (v) => v);

    const useCase = new CreateVehicleUseCase(vehicleRepo, clientRepo);
    const result = await useCase.execute({ plate: 'ABC1D23', brand: 'Fiat', model: 'Uno', year: 2021, clientId: 'client-1' });

    expect(result.plate).toBe('ABC1D23');
    expect(result.clientId).toBe('client-1');
  });

  it('deve criar veículo com placa padrão antigo (ABC-1234)', async () => {
    const vehicleRepo = makeVehicleRepo();
    const clientRepo = makeClientRepo();
    clientRepo.findById.mockResolvedValue(makeClient());
    vehicleRepo.findByPlate.mockResolvedValue(null);
    vehicleRepo.save.mockImplementation(async (v) => v);

    const useCase = new CreateVehicleUseCase(vehicleRepo, clientRepo);
    const result = await useCase.execute({ plate: 'ABC-1234', brand: 'VW', model: 'Gol', year: 2015, clientId: 'client-1' });

    expect(result.plate).toBe('ABC1234');
  });

  it('deve lançar AppError 422 para placa inválida', async () => {
    const vehicleRepo = makeVehicleRepo();
    const clientRepo = makeClientRepo();
    clientRepo.findById.mockResolvedValue(makeClient());

    const useCase = new CreateVehicleUseCase(vehicleRepo, clientRepo);

    await expect(
      useCase.execute({ plate: 'INVALIDA', brand: 'Fiat', model: 'Uno', year: 2021, clientId: 'client-1' }),
    ).rejects.toThrow(AppError);
  });

  it('deve lançar AppError 404 quando cliente não encontrado', async () => {
    const vehicleRepo = makeVehicleRepo();
    const clientRepo = makeClientRepo();
    clientRepo.findById.mockResolvedValue(null);

    const useCase = new CreateVehicleUseCase(vehicleRepo, clientRepo);

    await expect(
      useCase.execute({ plate: 'ABC1D23', brand: 'Fiat', model: 'Uno', year: 2021, clientId: 'nao-existe' }),
    ).rejects.toThrow(new AppError('Cliente não encontrado', 404));
  });

  it('deve lançar AppError 409 quando placa já cadastrada', async () => {
    const vehicleRepo = makeVehicleRepo();
    const clientRepo = makeClientRepo();
    clientRepo.findById.mockResolvedValue(makeClient());
    vehicleRepo.findByPlate.mockResolvedValue(makeVehicle());

    const useCase = new CreateVehicleUseCase(vehicleRepo, clientRepo);

    await expect(
      useCase.execute({ plate: 'ABC1D23', brand: 'Fiat', model: 'Uno', year: 2021, clientId: 'client-1' }),
    ).rejects.toThrow(new AppError('Placa já cadastrada', 409));
  });
});
