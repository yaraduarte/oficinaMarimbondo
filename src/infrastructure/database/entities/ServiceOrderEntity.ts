import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { ServiceOrderStatus } from '../../../domain/enums/ServiceOrderStatus';

@Entity('service_orders')
export class ServiceOrderEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'order_number', length: 20, unique: true })
  orderNumber: string;

  @Column({
    type: 'enum',
    enum: ServiceOrderStatus,
    default: ServiceOrderStatus.RECEBIDA,
  })
  status: ServiceOrderStatus;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId: string;

  @Column({ type: 'jsonb', default: '[]' })
  services: {
    serviceId: string;
    serviceName: string;
    price: number;
  }[];

  @Column({ type: 'jsonb', default: '[]' })
  parts: {
    partId: string;
    partName: string;
    quantity: number;
    unitPrice: number;
  }[];

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  budget: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
