export class Part {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  stockQuantity: number;
  minStockAlert: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<Part>) {
    Object.assign(this, data);
  }

  get isLowStock(): boolean {
    return this.stockQuantity <= this.minStockAlert;
  }
}
