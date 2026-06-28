import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { User } from '../../../domain/entities/User';
import { UserRole } from '../../../domain/enums/UserRole';
import { RegisterUserDTO } from '../../dtos/AuthDTOs';
import { AppError } from '../../../shared/errors/AppError';

export class RegisterUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(dto: RegisterUserDTO): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new AppError('E-mail já cadastrado', 409);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = new User({
      id: uuidv4(),
      name: dto.name,
      email: dto.email.toLowerCase(),
      passwordHash,
      role: dto.role ?? UserRole.MECHANIC,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const saved = await this.userRepository.save(user);
    const { passwordHash: _hash, ...safeUser } = saved;
    return safeUser as Omit<User, 'passwordHash'>;
  }
}
