export class Service {
  id: string;
  name: string;
  description: string;
  price: number;
  estimatedHours: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<Service>) {
    Object.assign(this, data);
  }
}
