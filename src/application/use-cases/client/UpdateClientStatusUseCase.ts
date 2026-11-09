import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { Client } from '../../../domain/entities/Client';
import { ClientStatus } from '../../../domain/enums/ClientStatus';
import { UpdateClientStatusDTO } from '../../dtos/ClientDTOs';
import { AppError } from '../../../shared/errors/AppError';

export class UpdateClientStatusUseCase {
  constructor(private readonly clientRepository: IClientRepository) {}

  async execute(id: string, dto: UpdateClientStatusDTO): Promise<Client> {
    const validStatuses = Object.values(ClientStatus) as string[];
    if (!dto?.status || !validStatuses.includes(dto.status)) {
      throw new AppError(`Status inválido. Valores aceitos: ${validStatuses.join(', ')}`, 422);
    }

    const client = await this.clientRepository.findById(id);
    if (!client) {
      throw new AppError('Cliente não encontrado', 404);
    }

    client.status = dto.status;
    client.updatedAt = new Date();
    return this.clientRepository.update(client);
  }
}
