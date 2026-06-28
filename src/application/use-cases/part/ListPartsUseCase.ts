import { IPartRepository } from '../../../domain/repositories/IPartRepository';

export interface PartWithLowStockFlag {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  stockQuantity: number;
  minStockAlert: number;
  isLowStock: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ListPartsUseCase {
  constructor(private readonly partRepository: IPartRepository) {}

  async execute(): Promise<PartWithLowStockFlag[]> {
    const parts = await this.partRepository.findAll();
    return parts.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      unitPrice: p.unitPrice,
      stockQuantity: p.stockQuantity,
      minStockAlert: p.minStockAlert,
      isLowStock: p.stockQuantity <= p.minStockAlert,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }
}
