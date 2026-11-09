import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { ClientAuthInfoDTO } from '../../dtos/ClientDTOs';
import { AppError } from '../../../shared/errors/AppError';

/**
 * Consulta usada pela Lambda de autenticação.
 * A Lambda não acessa mais o banco do os-service: ela chama este caso de uso via endpoint interno
 * e decide pelo campo `status` se emite ou nega o token.
 */
export class GetClientAuthInfoUseCase {
  constructor(private readonly clientRepository: IClientRepository) {}

  async execute(cpfCnpj: string): Promise<ClientAuthInfoDTO> {
    const cleaned = (cpfCnpj ?? '').replace(/\D/g, '');
    if (cleaned.length !== 11 && cleaned.length !== 14) {
      throw new AppError('CPF/CNPJ inválido', 422);
    }

    const client = await this.clientRepository.findByCpfCnpj(cleaned);
    if (!client) {
      throw new AppError('Cliente não encontrado', 404);
    }

    return {
      id: client.id,
      name: client.name,
      email: client.email,
      cpfCnpj: client.cpfCnpj,
      status: client.status,
      active: client.isActive(),
    };
  }
}
