export class Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  clientId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<Vehicle>) {
    Object.assign(this, data);
  }
}
