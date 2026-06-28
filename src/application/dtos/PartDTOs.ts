export interface CreatePartDTO {
  name: string;
  description: string;
  unitPrice: number;
  stockQuantity: number;
  minStockAlert: number;
}

export interface UpdatePartDTO {
  name?: string;
  description?: string;
  unitPrice?: number;
  stockQuantity?: number;
  minStockAlert?: number;
}
