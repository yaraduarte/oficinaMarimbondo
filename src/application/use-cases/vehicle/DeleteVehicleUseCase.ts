import { IVehicleRepository } from '../../../domain/repositories/IVehicleRepository';
import { AppError } from '../../../shared/errors/AppError';

export class DeleteVehicleUseCase {
  constructor(private readonly vehicleRepository: IVehicleRepository) {}

  async execute(id: string): Promise<void> {
    const vehicle = await this.vehicleRepository.findById(id);
    if (!vehicle) {
      throw new AppError('Veículo não encontrado', 404);
    }
    await this.vehicleRepository.delete(id);
  }
}
