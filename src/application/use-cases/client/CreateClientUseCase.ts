import { v4 as uuidv4 } from 'uuid';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { Client } from '../../../domain/entities/Client';
import { CreateClientDTO } from '../../dtos/ClientDTOs';
import { validateCpfCnpj } from '../../../shared/validators/cpfCnpjValidator';
import { AppError } from '../../../shared/errors/AppError';

export class CreateClientUseCase {
  constructor(private readonly clientRepository: IClientRepository) {}

  async execute(dto: CreateClientDTO): Promise<Client> {
    if (!validateCpfCnpj(dto.cpfCnpj)) {
      throw new AppError('CPF/CNPJ inválido', 422);
    }

    const cpfCnpjCleaned = dto.cpfCnpj.replace(/\D/g, '');

    const existingByCpfCnpj = await this.clientRepository.findByCpfCnpj(cpfCnpjCleaned);
    if (existingByCpfCnpj) {
      throw new AppError('CPF/CNPJ já cadastrado', 409);
    }

    const existingByEmail = await this.clientRepository.findByEmail(dto.email);
    if (existingByEmail) {
      throw new AppError('E-mail já cadastrado', 409);
    }

    const client = new Client({
      id: uuidv4(),
      name: dto.name,
      cpfCnpj: cpfCnpjCleaned,
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    return this.clientRepository.save(client);
  }
}
