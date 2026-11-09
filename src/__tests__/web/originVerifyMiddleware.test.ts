import { Request, Response } from 'express';
import { originVerifyMiddleware } from '../../infrastructure/web/middlewares/originVerifyMiddleware';

function req(path: string, header?: string): Request {
  return {
    path,
    header: (name: string) => (name === 'x-origin-verify' ? header : undefined),
  } as unknown as Request;
}

describe('originVerifyMiddleware', () => {
  const original = process.env.ORIGIN_VERIFY_SECRET;
  afterEach(() => {
    process.env.ORIGIN_VERIFY_SECRET = original;
  });

  it('fica desabilitado quando ORIGIN_VERIFY_SECRET não está definida', () => {
    delete process.env.ORIGIN_VERIFY_SECRET;
    const next = jest.fn();
    originVerifyMiddleware(req('/api/clients'), {} as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('aceita requisição com o header correto', () => {
    process.env.ORIGIN_VERIFY_SECRET = 'gw-secret';
    const next = jest.fn();
    originVerifyMiddleware(req('/api/clients', 'gw-secret'), {} as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it.each([undefined, '', 'outro', 'gw-secret-x'])('recusa com 403 header %p (acesso direto à EC2)', (h) => {
    process.env.ORIGIN_VERIFY_SECRET = 'gw-secret';
    const next = jest.fn();
    expect(() => originVerifyMiddleware(req('/api/clients', h), {} as Response, next)).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('libera /health para as probes do Kubernetes', () => {
    process.env.ORIGIN_VERIFY_SECRET = 'gw-secret';
    const next = jest.fn();
    originVerifyMiddleware(req('/health'), {} as Response, next);
    expect(next).toHaveBeenCalled();
  });
});
