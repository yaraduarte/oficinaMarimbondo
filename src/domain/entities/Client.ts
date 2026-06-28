export class Client {
  id: string;
  name: string;
  cpfCnpj: string;
  email: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  constructor(data: Partial<Client>) {
    Object.assign(this, data);
    this.deletedAt = data.deletedAt ?? null;
  }
}
