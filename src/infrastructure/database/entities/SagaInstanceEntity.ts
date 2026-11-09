import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index, VersionColumn } from 'typeorm';
import { SagaStatus, CompensationStep, SagaHistoryEntry } from '../../../domain/saga/ServiceOrderSaga';

@Entity('saga_instances')
export class SagaInstanceEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'service_order_id', type: 'uuid' })
  serviceOrderId: string;

  @Index()
  @Column({ type: 'varchar', length: 30 })
  status: SagaStatus;

  @Column({ name: 'quote_id', type: 'varchar', length: 64, nullable: true })
  quoteId: string | null;

  @Column({ name: 'payment_id', type: 'varchar', length: 64, nullable: true })
  paymentId: string | null;

  @Column({ name: 'execution_id', type: 'varchar', length: 64, nullable: true })
  executionId: string | null;

  @Column({ name: 'pending_compensations', type: 'jsonb', default: () => "'[]'" })
  pendingCompensations: CompensationStep[];

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;

  @Index()
  @Column({ name: 'approval_deadline', type: 'timestamptz', nullable: true })
  approvalDeadline: Date | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  history: SagaHistoryEntry[];

  /** Controle de concorrência otimista entre réplicas do orquestrador. */
  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
