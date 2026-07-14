import { INotificationService, NotificationPayload } from './INotificationService';
import { EmailNotificationService } from './EmailNotificationService';
import { WhatsAppNotificationService } from './WhatsAppNotificationService';

// Orquestra os dois canais: e-mail e WhatsApp em paralelo
export class NotificationService implements INotificationService {
  private readonly channels: INotificationService[];

  constructor() {
    this.channels = [
      new EmailNotificationService(),
      new WhatsAppNotificationService(),
    ];
  }

  async sendStatusUpdate(payload: NotificationPayload): Promise<void> {
    await Promise.allSettled(
      this.channels.map((channel) => channel.sendStatusUpdate(payload)),
    );
  }
}
