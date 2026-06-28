export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface IEmailService {
  send(options: SendEmailOptions): Promise<void>;
}
