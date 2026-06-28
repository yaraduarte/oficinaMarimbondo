import { ServiceOrderStatus, VALID_TRANSITIONS } from '../enums/ServiceOrderStatus';

export interface ServiceOrderPart {
  partId: string;
  partName: string;
  quantity: number;
  unitPrice: number;
}

export interface ServiceOrderService {
  serviceId: string;
  serviceName: string;
  price: number;
}

export class ServiceOrder {
  id: string;
  orderNumber: string;
  status: ServiceOrderStatus;
  clientId: string;
  vehicleId: string;
  services: ServiceOrderService[];
  parts: ServiceOrderPart[];
  budget: number;
  notes: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  constructor(data: Partial<ServiceOrder>) {
    Object.assign(this, data);
    this.services = data.services ?? [];
    this.parts = data.parts ?? [];
    this.notes = data.notes ?? null;
    this.approvedAt = data.approvedAt ?? null;
    this.deletedAt = data.deletedAt ?? null;
  }

  canTransitionTo(newStatus: ServiceOrderStatus): boolean {
    const allowed = VALID_TRANSITIONS[this.status];
    return allowed.includes(newStatus);
  }

  calculateBudget(): number {
    const serviceTotal = this.services.reduce((sum, s) => sum + s.price, 0);
    const partsTotal = this.parts.reduce((sum, p) => sum + p.unitPrice * p.quantity, 0);
    return serviceTotal + partsTotal;
  }
}
