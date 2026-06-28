import { IPartRepository } from '../../../domain/repositories/IPartRepository';
import { AppError } from '../../../shared/errors/AppError';

export class DeletePartUseCase {
  constructor(private readonly partRepository: IPartRepository) {}

  async execute(id: string): Promise<void> {
    const part = await this.partRepository.findById(id);
    if (!part) {
      throw new AppError('Peça não encontrada', 404);
    }
    await this.partRepository.delete(id);
  }
}
