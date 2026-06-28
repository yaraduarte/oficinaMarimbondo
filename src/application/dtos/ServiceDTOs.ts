export interface CreateServiceDTO {
  name: string;
  description: string;
  price: number;
  estimatedHours: number;
}

export interface UpdateServiceDTO {
  name?: string;
  description?: string;
  price?: number;
  estimatedHours?: number;
}
