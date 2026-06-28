import { v4 as uuidv4 } from 'uuid';
import { IPartRepository } from '../../../domain/repositories/IPartRepository';
import { Part } from '../../../domain/entities/Part';
import { CreatePartDTO } from '../../dtos/PartDTOs';

export class CreatePartUseCase {
  constructor(private readonly partRepository: IPartRepository) {}

  async execute(dto: CreatePartDTO): Promise<Part> {
    const part = new Part({
      id: uuidv4(),
      name: dto.name,
      description: dto.description,
      unitPrice: dto.unitPrice,
      stockQuantity: dto.stockQuantity,
      minStockAlert: dto.minStockAlert,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.partRepository.save(part);
  }
}
