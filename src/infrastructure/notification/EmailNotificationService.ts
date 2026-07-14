import nodemailer from 'nodemailer';
import { INotificationService, NotificationPayload } from './INotificationService';

export class EmailNotificationService implements INotificationService {
  async sendStatusUpdate(payload: NotificationPayload): Promise<void> {
    try {
      let transporter: nodemailer.Transporter;

      // Se não há SMTP configurado, cria conta Ethereal automática para preview
      if (!process.env.SMTP_USER) {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        console.log('[EmailService] Usando conta Ethereal de teste:', testAccount.user);
      } else {
        transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST ?? 'smtp.ethereal.email',
          port: parseInt(process.env.SMTP_PORT ?? '587', 10),
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS ?? '',
          },
        });
      }

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e63946;">🔧 Oficina Marimb0ndo</h2>
          <p>Olá, <strong>${payload.clientName}</strong>!</p>
          <p>Sua ordem de serviço <strong>${payload.orderNumber}</strong> teve o status atualizado:</p>
          <div style="background: #f1faee; border-left: 4px solid #e63946; padding: 16px; margin: 16px 0; border-radius: 4px;">
            <strong style="font-size: 18px;">${payload.newStatus}</strong>
          </div>
          <p>${payload.message}</p>
          <hr style="border: none; border-top: 1px solid #eee;" />
          <p style="color: #888; font-size: 12px;">Oficina Marimb0ndo — Sistema de Gestão</p>
        </div>
      `;

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM ?? '"Oficina Marimb0ndo" <noreply@oficina.com>',
        to: payload.clientEmail,
        subject: `OS ${payload.orderNumber} — Status: ${payload.newStatus}`,
        text: payload.message,
        html,
      });

      // Mostra link de preview quando usando Ethereal (perfeito para demonstração)
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[EmailService] Preview do e-mail: ${previewUrl}`);
      } else {
        console.log(`[EmailService] E-mail enviado para ${payload.clientEmail} — ID: ${info.messageId}`);
      }
    } catch (error) {
      console.error('[EmailService] Falha ao enviar e-mail:', error);
    }
  }
}
