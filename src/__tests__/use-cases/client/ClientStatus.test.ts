import { UpdateClientStatusUseCase } from '../../../application/use-cases/client/UpdateClientStatusUseCase';
import { DeleteClientUseCase } from '../../../application/use-cases/client/DeleteClientUseCase';
import { GetClientAuthInfoUseCase } from '../../../application/use-cases/internal/GetClientAuthInfoUseCase';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { Client } from '../../../domain/entities/Client';
import { ClientStatus } from '../../../domain/enums/ClientStatus';
import { AppError } from '../../../shared/errors/AppError';

function makeRepo(): jest.Mocked<IClientRepository> {
  return {
    findById: jest.fn(),
    findByCpfCnpj: jest.fn(),
    findByEmail: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    update: jest.fn(async (c: Client) => c),
    softDelete: jest.fn(),
  };
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return new Client({
    id: 'client-1',
    name: 'João Silva',
    cpfCnpj: '11144477735',
    email: 'joao@email.com',
    phone: '11999999999',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('Client entity', () => {
  it('assume status ATIVO por padrão', () => {
    expect(makeClient().status).toBe(ClientStatus.ATIVO);
    expect(makeClient().isActive()).toBe(true);
  });

  it.each([ClientStatus.INATIVO, ClientStatus.BLOQUEADO])('não é ativo com status %s', (status) => {
    expect(makeClient({ status }).isActive()).toBe(false);
  });

  it('não é ativo quando removido (deletedAt preenchido), mesmo com status ATIVO', () => {
    expect(makeClient({ deletedAt: new Date() }).isActive()).toBe(false);
  });
});

describe('UpdateClientStatusUseCase', () => {
  it('altera o status e atualiza updatedAt', async () => {
    const repo = makeRepo();
    const old = new Date('2020-01-01');
    repo.findById.mockResolvedValue(makeClient({ updatedAt: old }));

    const result = await new UpdateClientStatusUseCase(repo).execute('client-1', { status: ClientStatus.BLOQUEADO });

    expect(result.status).toBe(ClientStatus.BLOQUEADO);
    expect(result.updatedAt.getTime()).toBeGreaterThan(old.getTime());
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('rejeita status inválido com 422 sem consultar o repositório', async () => {
    const repo = makeRepo();
    await expect(
      new UpdateClientStatusUseCase(repo).execute('client-1', { status: 'SUSPENSO' as ClientStatus }),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('rejeita body sem status com 422', async () => {
    const repo = makeRepo();
    await expect(new UpdateClientStatusUseCase(repo).execute('client-1', undefined as never)).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('retorna 404 quando cliente não existe', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null);
    await expect(new UpdateClientStatusUseCase(repo).execute('x', { status: ClientStatus.ATIVO })).rejects.toThrow(
      new AppError('Cliente não encontrado', 404),
    );
  });
});

describe('DeleteClientUseCase', () => {
  it('inativa o cliente antes do soft delete', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(makeClient());

    await new DeleteClientUseCase(repo).execute('client-1');

    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ status: ClientStatus.INATIVO }));
    expect(repo.softDelete).toHaveBeenCalledWith('client-1');
    expect(repo.update.mock.invocationCallOrder[0]).toBeLessThan(repo.softDelete.mock.invocationCallOrder[0]);
  });

  it('retorna 404 quando cliente não existe', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null);
    await expect(new DeleteClientUseCase(repo).execute('x')).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.softDelete).not.toHaveBeenCalled();
  });
});

describe('GetClientAuthInfoUseCase', () => {
  it('retorna dados do cliente ativo com active=true, aceitando CPF formatado', async () => {
    const repo = makeRepo();
    repo.findByCpfCnpj.mockResolvedValue(makeClient());

    const result = await new GetClientAuthInfoUseCase(repo).execute('111.444.777-35');

    expect(repo.findByCpfCnpj).toHaveBeenCalledWith('11144477735');
    expect(result).toEqual({
      id: 'client-1',
      name: 'João Silva',
      email: 'joao@email.com',
      cpfCnpj: '11144477735',
      status: ClientStatus.ATIVO,
      active: true,
    });
  });

  it('retorna active=false para cliente INATIVO (a Lambda nega o token)', async () => {
    const repo = makeRepo();
    repo.findByCpfCnpj.mockResolvedValue(makeClient({ status: ClientStatus.INATIVO }));

    const result = await new GetClientAuthInfoUseCase(repo).execute('11144477735');

    expect(result.status).toBe(ClientStatus.INATIVO);
    expect(result.active).toBe(false);
  });

  it('retorna 404 quando não encontrado', async () => {
    const repo = makeRepo();
    repo.findByCpfCnpj.mockResolvedValue(null);
    await expect(new GetClientAuthInfoUseCase(repo).execute('11144477735')).rejects.toMatchObject({ statusCode: 404 });
  });

  it.each(['', '123', undefined as unknown as string])('retorna 422 para documento malformado (%p)', async (doc) => {
    const repo = makeRepo();
    await expect(new GetClientAuthInfoUseCase(repo).execute(doc)).rejects.toMatchObject({ statusCode: 422 });
    expect(repo.findByCpfCnpj).not.toHaveBeenCalled();
  });
});
