import { IServiceRepository } from '../../../domain/repositories/IServiceRepository';
import { Service } from '../../../domain/entities/Service';
import { UpdateServiceDTO } from '../../dtos/ServiceDTOs';
import { AppError } from '../../../shared/errors/AppError';

export class UpdateServiceUseCase {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(id: string, dto: UpdateServiceDTO): Promise<Service> {
    const service = await this.serviceRepository.findById(id);
    if (!service) {
      throw new AppError('Serviço não encontrado', 404);
    }

    if (dto.name !== undefined) service.name = dto.name;
    if (dto.description !== undefined) service.description = dto.description;
    if (dto.price !== undefined) service.price = dto.price;
    if (dto.estimatedHours !== undefined) service.estimatedHours = dto.estimatedHours;
    service.updatedAt = new Date();

    return this.serviceRepository.update(service);
  }
}
