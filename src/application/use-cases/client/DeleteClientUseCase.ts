import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { AppError } from '../../../shared/errors/AppError';

export class DeleteClientUseCase {
  constructor(private readonly clientRepository: IClientRepository) {}

  async execute(id: string): Promise<void> {
    const client = await this.clientRepository.findById(id);
    if (!client) {
      throw new AppError('Cliente não encontrado', 404);
    }
    await this.clientRepository.softDelete(id);
  }
}
