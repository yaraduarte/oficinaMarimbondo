import { ServiceOrderStatus } from '../../domain/enums/ServiceOrderStatus';

export interface CreateServiceOrderDTO {
  clientId: string;
  vehicleId: string;
  serviceIds: string[];
  parts: { partId: string; quantity: number }[];
  notes?: string;
}

export interface ApproveQuoteDTO {
  decision: 'approved' | 'rejected';
}

export interface UpdateServiceOrderStatusDTO {
  status: ServiceOrderStatus;
}
