import { IClientRepository, PaginatedResult } from '../../../domain/repositories/IClientRepository';
import { Client } from '../../../domain/entities/Client';
import { ListClientsDTO } from '../../dtos/ClientDTOs';

export class ListClientsUseCase {
  constructor(private readonly clientRepository: IClientRepository) {}

  async execute(dto: ListClientsDTO): Promise<PaginatedResult<Client>> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    return this.clientRepository.findAll({ page, limit, name: dto.name });
  }
}
