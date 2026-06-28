import { IServiceRepository } from '../../../domain/repositories/IServiceRepository';
import { AppError } from '../../../shared/errors/AppError';

export class DeleteServiceUseCase {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(id: string): Promise<void> {
    const service = await this.serviceRepository.findById(id);
    if (!service) {
      throw new AppError('Serviço não encontrado', 404);
    }
    await this.serviceRepository.delete(id);
  }
}
