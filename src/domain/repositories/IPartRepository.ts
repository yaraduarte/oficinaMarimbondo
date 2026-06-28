import { Part } from '../entities/Part';

export interface IPartRepository {
  findById(id: string): Promise<Part | null>;
  findAll(): Promise<Part[]>;
  save(part: Part): Promise<Part>;
  update(part: Part): Promise<Part>;
  delete(id: string): Promise<void>;
}
