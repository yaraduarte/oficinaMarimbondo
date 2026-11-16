import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { EmailNotificationService } from '../../infrastructure/notification/EmailNotificationService';
import { WhatsAppNotificationService } from '../../infrastructure/notification/WhatsAppNotificationService';
import { NotificationService } from '../../infrastructure/notification/NotificationService';
import { NodemailerEmailService } from '../../infrastructure/email/NodemailerEmailService';
import { NotificationPayload } from '../../infrastructure/notification/INotificationService';

jest.mock('nodemailer');
jest.mock('twilio');

const mockedNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;
const mockedTwilio = twilio as unknown as jest.Mock;

const payload: NotificationPayload = {
  clientName: 'João',
  clientEmail: 'joao@email.com',
  clientPhone: '(11) 99999-8888',
  orderNumber: 'OS-2026-001',
  newStatus: 'EM_EXECUCAO',
  message: 'Sua OS entrou em execução',
};

const ENV_KEYS = ['SMTP_USER', 'SMTP_PASS', 'SMTP_HOST', 'SMTP_PORT', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'];
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  jest.clearAllMocks();
  ENV_KEYS.forEach((k) => {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  ENV_KEYS.forEach((k) => {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  });
  jest.restoreAllMocks();
});

function mockTransport(sendMail: jest.Mock) {
  mockedNodemailer.createTransport.mockReturnValue({ sendMail } as unknown as nodemailer.Transporter);
}

describe('EmailNotificationService', () => {
  it('usa conta Ethereal de teste sem SMTP configurado e loga o preview', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'm-1' });
    mockTransport(sendMail);
    mockedNodemailer.createTestAccount.mockResolvedValue({ user: 'u', pass: 'p' } as never);
    mockedNodemailer.getTestMessageUrl.mockReturnValue('https://ethereal.email/message/1');

    await new EmailNotificationService().sendStatusUpdate(payload);

    expect(mockedNodemailer.createTestAccount).toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'joao@email.com', subject: 'OS OS-2026-001 — Status: EM_EXECUCAO' }),
    );
  });

  it('usa SMTP configurado quando há SMTP_USER', async () => {
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_HOST = 'smtp.exemplo.com';
    process.env.SMTP_PORT = '2525';
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'm-2' });
    mockTransport(sendMail);
    mockedNodemailer.getTestMessageUrl.mockReturnValue(false);

    await new EmailNotificationService().sendStatusUpdate(payload);

    expect(mockedNodemailer.createTestAccount).not.toHaveBeenCalled();
    expect(mockedNodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.exemplo.com', port: 2525 }),
    );
  });

  it('não propaga falha de envio', async () => {
    process.env.SMTP_USER = 'smtp-user';
    mockTransport(jest.fn().mockRejectedValue(new Error('SMTP fora')));
    await expect(new EmailNotificationService().sendStatusUpdate(payload)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

describe('WhatsAppNotificationService', () => {
  it('fica desabilitado sem credenciais Twilio', async () => {
    await new WhatsAppNotificationService().sendStatusUpdate(payload);
    expect(mockedTwilio).not.toHaveBeenCalled();
  });

  it('envia mensagem formatando o número com DDI 55', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC1';
    process.env.TWILIO_AUTH_TOKEN = 't';
    const create = jest.fn().mockResolvedValue({ sid: 'SM1' });
    mockedTwilio.mockReturnValue({ messages: { create } });

    await new WhatsAppNotificationService().sendStatusUpdate(payload);
    await new WhatsAppNotificationService().sendStatusUpdate({ ...payload, clientPhone: '5511999998888' });

    expect(create).toHaveBeenNthCalledWith(1, expect.objectContaining({ to: 'whatsapp:+5511999998888' }));
    expect(create).toHaveBeenNthCalledWith(2, expect.objectContaining({ to: 'whatsapp:+5511999998888' }));
  });

  it('não propaga falha do Twilio', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC1';
    process.env.TWILIO_AUTH_TOKEN = 't';
    mockedTwilio.mockReturnValue({ messages: { create: jest.fn().mockRejectedValue(new Error('x')) } });
    await expect(new WhatsAppNotificationService().sendStatusUpdate(payload)).resolves.toBeUndefined();
  });
});

describe('NotificationService', () => {
  it('dispara todos os canais mesmo que um falhe', async () => {
    const email = jest.spyOn(EmailNotificationService.prototype, 'sendStatusUpdate').mockRejectedValue(new Error('x'));
    const whats = jest.spyOn(WhatsAppNotificationService.prototype, 'sendStatusUpdate').mockResolvedValue();

    await expect(new NotificationService().sendStatusUpdate(payload)).resolves.toBeUndefined();

    expect(email).toHaveBeenCalledWith(payload);
    expect(whats).toHaveBeenCalledWith(payload);
  });
});

describe('NodemailerEmailService', () => {
  it('envia e-mail e não propaga falhas', async () => {
    const sendMail = jest.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('x'));
    mockTransport(sendMail);
    const svc = new NodemailerEmailService();

    await svc.send({ to: 'a@b.com', subject: 's', text: 't' });
    await expect(svc.send({ to: 'a@b.com', subject: 's', text: 't' })).resolves.toBeUndefined();
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
});
