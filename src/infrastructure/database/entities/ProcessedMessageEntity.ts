import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

/** Inbox de idempotência: messageIds já processados pelo orquestrador. */
@Entity('processed_messages')
export class ProcessedMessageEntity {
  @PrimaryColumn({ name: 'message_id', type: 'varchar', length: 64 })
  messageId: string;

  @Column({ type: 'varchar', length: 100 })
  type: string;

  @CreateDateColumn({ name: 'processed_at', type: 'timestamptz' })
  processedAt: Date;
}
