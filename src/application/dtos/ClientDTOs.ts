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
