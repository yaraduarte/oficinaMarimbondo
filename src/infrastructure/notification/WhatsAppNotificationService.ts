import twilio from 'twilio';
import { INotificationService, NotificationPayload } from './INotificationService';

export class WhatsAppNotificationService implements INotificationService {
  private client: twilio.Twilio | null = null;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
    } else {
      console.warn('[WhatsAppService] Credenciais Twilio não configuradas — notificações WhatsApp desabilitadas.');
    }
  }

  async sendStatusUpdate(payload: NotificationPayload): Promise<void> {
    if (!this.client) return;

    const from = `whatsapp:${process.env.TWILIO_WHATSAPP_FROM ?? '+14155238886'}`;

    // Formata o número: remove tudo que não é dígito e adiciona código do Brasil
    const digits = payload.clientPhone.replace(/\D/g, '');
    const to = `whatsapp:+55${digits.startsWith('55') ? digits.slice(2) : digits}`;

    const body =
      `🔧 *Oficina Marimb0ndo*\n\n` +
      `Olá, ${payload.clientName}!\n\n` +
      `Sua OS *${payload.orderNumber}* teve o status atualizado:\n\n` +
      `📌 *${payload.newStatus}*\n\n` +
      `${payload.message}`;

    try {
      const message = await this.client.messages.create({ from, to, body });
      console.log(`[WhatsAppService] Mensagem enviada para ${to} — SID: ${message.sid}`);
    } catch (error) {
      console.error('[WhatsAppService] Falha ao enviar WhatsApp:', error);
    }
  }
}
