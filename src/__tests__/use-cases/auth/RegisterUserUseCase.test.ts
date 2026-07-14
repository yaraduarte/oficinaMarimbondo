import { RegisterUserUseCase } from '../../../application/use-cases/auth/RegisterUserUseCase';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { User } from '../../../domain/entities/User';
import { UserRole } from '../../../domain/enums/UserRole';
import { AppError } from '../../../shared/errors/AppError';

function makeRepo(): jest.Mocked<IUserRepository> {
  return {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    save: jest.fn(),
  };
}

function makeUser(role = UserRole.MECHANIC): User {
  return new User({
    id: 'user-1',
    name: 'Mecânico',
    email: 'mecanico@oficina.com',
    passwordHash: '$2b$10$hash',
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('RegisterUserUseCase', () => {
  it('deve registrar usuário e omitir passwordHash da resposta', async () => {
    const repo = makeRepo();
    repo.findByEmail.mockResolvedValue(null);
    repo.save.mockImplementation(async (u) => u);

    const useCase = new RegisterUserUseCase(repo);
    const result = await useCase.execute({ name: 'Mecânico', email: 'mecanico@oficina.com', password: 'Senha@123' });

    expect(result.email).toBe('mecanico@oficina.com');
    expect((result as any).passwordHash).toBeUndefined();
  });

  it('deve aplicar role padrão MECHANIC quando não informado', async () => {
    const repo = makeRepo();
    repo.findByEmail.mockResolvedValue(null);
    repo.save.mockImplementation(async (u) => u);

    const useCase = new RegisterUserUseCase(repo);
    const result = await useCase.execute({ name: 'Mecânico', email: 'mec@oficina.com', password: 'Senha@123' });

    expect(result.role).toBe(UserRole.MECHANIC);
  });

  it('deve aceitar role ADMIN explicitamente', async () => {
    const repo = makeRepo();
    repo.findByEmail.mockResolvedValue(null);
    repo.save.mockImplementation(async (u) => u);

    const useCase = new RegisterUserUseCase(repo);
    const result = await useCase.execute({ name: 'Admin', email: 'admin@oficina.com', password: 'Senha@123', role: UserRole.ADMIN });

    expect(result.role).toBe(UserRole.ADMIN);
  });

  it('deve lançar AppError 409 quando e-mail já existe', async () => {
    const repo = makeRepo();
    repo.findByEmail.mockResolvedValue(makeUser());

    const useCase = new RegisterUserUseCase(repo);

    await expect(
      useCase.execute({ name: 'Outro', email: 'mecanico@oficina.com', password: 'Senha@123' }),
    ).rejects.toThrow(new AppError('E-mail já cadastrado', 409));
  });

  it('deve normalizar e-mail para lowercase', async () => {
    const repo = makeRepo();
    repo.findByEmail.mockResolvedValue(null);
    repo.save.mockImplementation(async (u) => u);

    const useCase = new RegisterUserUseCase(repo);
    const result = await useCase.execute({ name: 'Admin', email: 'ADMIN@OFICINA.COM', password: 'Senha@123' });

    expect(result.email).toBe('admin@oficina.com');
  });

  it('deve fazer hash da senha antes de salvar', async () => {
    const repo = makeRepo();
    repo.findByEmail.mockResolvedValue(null);

    let savedUser: User | undefined;
    repo.save.mockImplementation(async (u) => {
      savedUser = u;
      return u;
    });

    const useCase = new RegisterUserUseCase(repo);
    await useCase.execute({ name: 'Admin', email: 'admin@oficina.com', password: 'senha_plana' });

    expect(savedUser?.passwordHash).not.toBe('senha_plana');
    expect(savedUser?.passwordHash).toMatch(/^\$2[ab]\$/);
  });
});
