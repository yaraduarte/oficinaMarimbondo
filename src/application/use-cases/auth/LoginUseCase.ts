import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { LoginDTO, AuthResponseDTO } from '../../dtos/AuthDTOs';
import { AppError } from '../../../shared/errors/AppError';
import { JWT_AUDIENCE, JWT_STAFF_ISSUER } from '../../../shared/auth/jwtConfig';

export class LoginUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly jwtSecret: string,
    private readonly jwtExpiresIn: string,
  ) {}

  async execute(dto: LoginDTO): Promise<AuthResponseDTO> {
    const user = await this.userRepository.findByEmail(dto.email.toLowerCase());
    if (!user) {
      throw new AppError('Credenciais inválidas', 401);
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new AppError('Credenciais inválidas', 401);
    }

    const payload = { sub: user.id, role: user.role, type: 'staff' };
    const token = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn as jwt.SignOptions['expiresIn'],
      // Validados pelo authorizer do API Gateway
      issuer: JWT_STAFF_ISSUER,
      audience: JWT_AUDIENCE,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
