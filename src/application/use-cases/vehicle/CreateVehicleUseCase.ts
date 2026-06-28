import { v4 as uuidv4 } from 'uuid';
import { IVehicleRepository } from '../../../domain/repositories/IVehicleRepository';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { Vehicle } from '../../../domain/entities/Vehicle';
import { CreateVehicleDTO } from '../../dtos/VehicleDTOs';
import { validatePlate } from '../../../shared/validators/plateValidator';
import { AppError } from '../../../shared/errors/AppError';

export class CreateVehicleUseCase {
  constructor(
    private readonly vehicleRepository: IVehicleRepository,
    private readonly clientRepository: IClientRepository,
  ) {}

  async execute(dto: CreateVehicleDTO): Promise<Vehicle> {
    if (!validatePlate(dto.plate)) {
      throw new AppError('Placa inválida. Use o formato ABC-1234 ou ABC1D23 (Mercosul)', 422);
    }

    const client = await this.clientRepository.findById(dto.clientId);
    if (!client) {
      throw new AppError('Cliente não encontrado', 404);
    }

    const plateCleaned = dto.plate.replace(/[-\s]/g, '').toUpperCase();
    const existing = await this.vehicleRepository.findByPlate(plateCleaned);
    if (existing) {
      throw new AppError('Placa já cadastrada', 409);
    }

    const vehicle = new Vehicle({
      id: uuidv4(),
      plate: plateCleaned,
      brand: dto.brand,
      model: dto.model,
      year: dto.year,
      clientId: dto.clientId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.vehicleRepository.save(vehicle);
  }
}
