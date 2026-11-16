import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { MessageEnvelope } from '../../../domain/saga/SagaMessages';

export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'PUBLISHED';

/** Transactional outbox: mensagens gravadas junto com o estado e publicadas pelo relay. */
@Entity('outbox_messages')
@Index(['status', 'createdAt'])
export class OutboxMessageEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  exchange: string;

  @Column({ name: 'routing_key', type: 'varchar', length: 100 })
  routingKey: string;

  @Column({ type: 'varchar', length: 100 })
  type: string;

  @Column({ type: 'jsonb' })
  envelope: MessageEnvelope;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: OutboxStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'claimed_at', type: 'timestamptz', nullable: true })
  claimedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;
}
