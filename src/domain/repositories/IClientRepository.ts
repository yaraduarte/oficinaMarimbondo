import { Client } from '../entities/Client';

export interface ListClientsOptions {
  page: number;
  limit: number;
  name?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface IClientRepository {
  findById(id: string): Promise<Client | null>;
  findByCpfCnpj(cpfCnpj: string): Promise<Client | null>;
  findByEmail(email: string): Promise<Client | null>;
  findAll(options: ListClientsOptions): Promise<PaginatedResult<Client>>;
  save(client: Client): Promise<Client>;
  update(client: Client): Promise<Client>;
  softDelete(id: string): Promise<void>;
}
