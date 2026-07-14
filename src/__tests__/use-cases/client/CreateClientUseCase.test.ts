import { CreateClientUseCase } from '../../../application/use-cases/client/CreateClientUseCase';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { Client } from '../../../domain/entities/Client';
import { AppError } from '../../../shared/errors/AppError';

function makeRepo(): jest.Mocked<IClientRepository> {
  return {
    findById: jest.fn(),
    findByCpfCnpj: jest.fn(),
    findByEmail: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };
}

function makeClient(overrides = {}): Client {
  return new Client({
    id: 'client-1',
    name: 'João Silva',
    cpfCnpj: '11144477735',
    email: 'joao@email.com',
    phone: '11999999999',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });
}

describe('CreateClientUseCase', () => {
  it('deve criar cliente com CPF válido e retornar o objeto salvo', async () => {
    const repo = makeRepo();
    repo.findByCpfCnpj.mockResolvedValue(null);
    repo.findByEmail.mockResolvedValue(null);
    repo.save.mockImplementation(async (c) => c);

    const useCase = new CreateClientUseCase(repo);
    const result = await useCase.execute({
      name: 'João Silva',
      cpfCnpj: '111.444.777-35',
      email: 'joao@email.com',
      phone: '11999999999',
    });

    expect(result.name).toBe('João Silva');
    expect(result.cpfCnpj).toBe('11144477735');
    expect(result.email).toBe('joao@email.com');
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('deve criar cliente com CNPJ válido', async () => {
    const repo = makeRepo();
    repo.findByCpfCnpj.mockResolvedValue(null);
    repo.findByEmail.mockResolvedValue(null);
    repo.save.mockImplementation(async (c) => c);

    const useCase = new CreateClientUseCase(repo);
    const result = await useCase.execute({
      name: 'Empresa XYZ',
      cpfCnpj: '11.222.333/0001-81',
      email: 'empresa@xyz.com',
      phone: '1132223333',
    });

    expect(result.cpfCnpj).toBe('11222333000181');
  });

  it('deve lançar AppError 422 para CPF inválido', async () => {
    const repo = makeRepo();
    const useCase = new CreateClientUseCase(repo);

    await expect(
      useCase.execute({ name: 'Teste', cpfCnpj: '111.111.111-11', email: 't@t.com', phone: '11999999999' }),
    ).rejects.toThrow(new AppError('CPF/CNPJ inválido', 422));
  });

  it('deve lançar AppError 409 quando CPF já cadastrado', async () => {
    const repo = makeRepo();
    repo.findByCpfCnpj.mockResolvedValue(makeClient());
    repo.findByEmail.mockResolvedValue(null);

    const useCase = new CreateClientUseCase(repo);

    await expect(
      useCase.execute({ name: 'João', cpfCnpj: '111.444.777-35', email: 'outro@email.com', phone: '11999999999' }),
    ).rejects.toThrow(new AppError('CPF/CNPJ já cadastrado', 409));
  });

  it('deve lançar AppError 409 quando e-mail já cadastrado', async () => {
    const repo = makeRepo();
    repo.findByCpfCnpj.mockResolvedValue(null);
    repo.findByEmail.mockResolvedValue(makeClient());

    const useCase = new CreateClientUseCase(repo);

    await expect(
      useCase.execute({ name: 'João', cpfCnpj: '111.444.777-35', email: 'joao@email.com', phone: '11999999999' }),
    ).rejects.toThrow(new AppError('E-mail já cadastrado', 409));
  });

  it('deve normalizar e-mail para lowercase ao salvar', async () => {
    const repo = makeRepo();
    repo.findByCpfCnpj.mockResolvedValue(null);
    repo.findByEmail.mockResolvedValue(null);
    repo.save.mockImplementation(async (c) => c);

    const useCase = new CreateClientUseCase(repo);
    const result = await useCase.execute({
      name: 'João',
      cpfCnpj: '111.444.777-35',
      email: 'JOAO@EMAIL.COM',
      phone: '11999999999',
    });

    expect(result.email).toBe('joao@email.com');
  });
});
