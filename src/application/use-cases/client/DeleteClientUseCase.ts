import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { AppError } from '../../../shared/errors/AppError';
import { ClientStatus } from '../../../domain/enums/ClientStatus';

export class DeleteClientUseCase {
  constructor(private readonly clientRepository: IClientRepository) {}

  async execute(id: string): Promise<void> {
    const client = await this.clientRepository.findById(id);
    if (!client) {
      throw new AppError('Cliente não encontrado', 404);
    }
    // Inativa explicitamente antes do soft delete: o status é a fonte da verdade para autenticação
    client.status = ClientStatus.INATIVO;
    client.updatedAt = new Date();
    await this.clientRepository.update(client);
    await this.clientRepository.softDelete(id);
  }
}
