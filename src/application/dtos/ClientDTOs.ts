import { ClientStatus } from '../../domain/enums/ClientStatus';

export interface CreateClientDTO {
  name: string;
  cpfCnpj: string;
  email: string;
  phone: string;
}

export interface UpdateClientDTO {
  name?: string;
  email?: string;
  phone?: string;
}

export interface ListClientsDTO {
  page?: number;
  limit?: number;
  name?: string;
}

export interface UpdateClientStatusDTO {
  status: ClientStatus;
}

/** Dados expostos para outros serviços (ex.: Lambda de autenticação). */
export interface ClientAuthInfoDTO {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  status: ClientStatus;
  active: boolean;
}
