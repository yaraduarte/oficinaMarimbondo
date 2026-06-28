import { IServiceRepository } from '../../../domain/repositories/IServiceRepository';
import { Service } from '../../../domain/entities/Service';

export class ListServicesUseCase {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(): Promise<Service[]> {
    return this.serviceRepository.findAll();
  }
}
