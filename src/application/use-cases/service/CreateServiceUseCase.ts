import { v4 as uuidv4 } from 'uuid';
import { IServiceRepository } from '../../../domain/repositories/IServiceRepository';
import { Service } from '../../../domain/entities/Service';
import { CreateServiceDTO } from '../../dtos/ServiceDTOs';

export class CreateServiceUseCase {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(dto: CreateServiceDTO): Promise<Service> {
    const service = new Service({
      id: uuidv4(),
      name: dto.name,
      description: dto.description,
      price: dto.price,
      estimatedHours: dto.estimatedHours,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.serviceRepository.save(service);
  }
}
