export interface NotificationPayload {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  orderNumber: string;
  newStatus: string;
  message: string;
}

export interface INotificationService {
  sendStatusUpdate(payload: NotificationPayload): Promise<void>;
}
