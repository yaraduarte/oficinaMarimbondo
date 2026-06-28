import { IPartRepository } from '../../../domain/repositories/IPartRepository';
import { Part } from '../../../domain/entities/Part';
import { UpdatePartDTO } from '../../dtos/PartDTOs';
import { AppError } from '../../../shared/errors/AppError';

export class UpdatePartUseCase {
  constructor(private readonly partRepository: IPartRepository) {}

  async execute(id: string, dto: UpdatePartDTO): Promise<Part> {
    const part = await this.partRepository.findById(id);
    if (!part) {
      throw new AppError('Peça não encontrada', 404);
    }

    if (dto.name !== undefined) part.name = dto.name;
    if (dto.description !== undefined) part.description = dto.description;
    if (dto.unitPrice !== undefined) part.unitPrice = dto.unitPrice;
    if (dto.stockQuantity !== undefined) part.stockQuantity = dto.stockQuantity;
    if (dto.minStockAlert !== undefined) part.minStockAlert = dto.minStockAlert;
    part.updatedAt = new Date();

    return this.partRepository.update(part);
  }
}
