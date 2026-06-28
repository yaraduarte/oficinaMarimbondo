import { DataSource, Repository } from 'typeorm';
import { UserEntity } from '../entities/UserEntity';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { User } from '../../../domain/entities/User';

function toDomain(entity: UserEntity): User {
  return new User({
    id: entity.id,
    name: entity.name,
    email: entity.email,
    passwordHash: entity.passwordHash,
    role: entity.role,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  });
}

export class TypeORMUserRepository implements IUserRepository {
  private readonly repo: Repository<UserEntity>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(UserEntity);
  }

  async findById(id: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { email } });
    return entity ? toDomain(entity) : null;
  }

  async save(user: User): Promise<User> {
    const entity = new UserEntity();
    Object.assign(entity, user);
    const saved = await this.repo.save(entity);
    return toDomain(saved);
  }
}
