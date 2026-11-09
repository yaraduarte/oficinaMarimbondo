import { ClientStatus } from '../enums/ClientStatus';

export class Client {
  id: string;
  name: string;
  cpfCnpj: string;
  email: string;
  phone: string;
  status: ClientStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  constructor(data: Partial<Client>) {
    Object.assign(this, data);
    this.status = data.status ?? ClientStatus.ATIVO;
    this.deletedAt = data.deletedAt ?? null;
  }

  isActive(): boolean {
    return this.status === ClientStatus.ATIVO && this.deletedAt === null;
  }
}
