import { IVehicleRepository } from '../../../domain/repositories/IVehicleRepository';
import { Vehicle } from '../../../domain/entities/Vehicle';

export class ListVehiclesUseCase {
  constructor(private readonly vehicleRepository: IVehicleRepository) {}

  async execute(clientId?: string): Promise<Vehicle[]> {
    if (clientId) {
      return this.vehicleRepository.findByClientId(clientId);
    }
    return this.vehicleRepository.findAll();
  }
}
