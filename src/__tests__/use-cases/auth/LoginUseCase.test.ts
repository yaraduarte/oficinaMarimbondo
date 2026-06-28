import bcrypt from 'bcryptjs';
import { LoginUseCase } from '../../../application/use-cases/auth/LoginUseCase';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { User } from '../../../domain/entities/User';
import { UserRole } from '../../../domain/enums/UserRole';
import { AppError } from '../../../shared/errors/AppError';

const JWT_SECRET = 'test-secret';
const JWT_EXPIRES_IN = '1h';

async function makeUser(): Promise<User> {
  const passwordHash = await bcrypt.hash('senha123', 10);
  return new User({
    id: 'user-1',
    name: 'Admin',
    email: 'admin@oficina.com',
    passwordHash,
    role: UserRole.ADMIN,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('LoginUseCase', () => {
  let mockUserRepo: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      save: jest.fn(),
    };
  });

  it('deve retornar token JWT ao autenticar com credenciais válidas', async () => {
    const user = await makeUser();
    mockUserRepo.findByEmail.mockResolvedValue(user);

    const useCase = new LoginUseCase(mockUserRepo, JWT_SECRET, JWT_EXPIRES_IN);
    const result = await useCase.execute({ email: 'admin@oficina.com', password: 'senha123' });

    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.user.email).toBe('admin@oficina.com');
    expect(result.user.role).toBe(UserRole.ADMIN);
  });

  it('deve lançar erro quando usuário não existe', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);

    const useCase = new LoginUseCase(mockUserRepo, JWT_SECRET, JWT_EXPIRES_IN);

    await expect(useCase.execute({ email: 'naoexiste@email.com', password: 'senha123' }))
      .rejects.toThrow(AppError);
  });

  it('deve lançar erro quando senha incorreta', async () => {
    const user = await makeUser();
    mockUserRepo.findByEmail.mockResolvedValue(user);

    const useCase = new LoginUseCase(mockUserRepo, JWT_SECRET, JWT_EXPIRES_IN);

    await expect(useCase.execute({ email: 'admin@oficina.com', password: 'senhaerrada' }))
      .rejects.toThrow(AppError);
  });

  it('deve normalizar email para lowercase ao buscar', async () => {
    const user = await makeUser();
    mockUserRepo.findByEmail.mockResolvedValue(user);

    const useCase = new LoginUseCase(mockUserRepo, JWT_SECRET, JWT_EXPIRES_IN);
    await useCase.execute({ email: 'ADMIN@OFICINA.COM', password: 'senha123' });

    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('admin@oficina.com');
  });
});
