import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { Client } from '../../../domain/entities/Client';
import { UpdateClientDTO } from '../../dtos/ClientDTOs';
import { AppError } from '../../../shared/errors/AppError';

export class UpdateClientUseCase {
  constructor(private readonly clientRepository: IClientRepository) {}

  async execute(id: string, dto: UpdateClientDTO): Promise<Client> {
    const client = await this.clientRepository.findById(id);
    if (!client) {
      throw new AppError('Cliente não encontrado', 404);
    }

    if (dto.name !== undefined) client.name = dto.name;
    if (dto.email !== undefined) client.email = dto.email.toLowerCase();
    if (dto.phone !== undefined) client.phone = dto.phone;
    client.updatedAt = new Date();

    return this.clientRepository.update(client);
  }
}
