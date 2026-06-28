import { IPartRepository } from '../../../domain/repositories/IPartRepository';
import { Part } from '../../../domain/entities/Part';
import { AppError } from '../../../shared/errors/AppError';

export class GetPartUseCase {
  constructor(private readonly partRepository: IPartRepository) {}

  async execute(id: string): Promise<Part> {
    const part = await this.partRepository.findById(id);
    if (!part) {
      throw new AppError('Peça não encontrada', 404);
    }
    return part;
  }
}
