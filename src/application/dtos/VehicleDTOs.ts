export interface CreateVehicleDTO {
  plate: string;
  brand: string;
  model: string;
  year: number;
  clientId: string;
}

export interface UpdateVehicleDTO {
  brand?: string;
  model?: string;
  year?: number;
}
