import { Request, Response } from 'express';
import { internalApiKeyMiddleware } from '../../infrastructure/web/middlewares/internalApiKeyMiddleware';

function req(key?: string): Request {
  return { header: (name: string) => (name === 'x-internal-api-key' ? key : undefined) } as unknown as Request;
}

describe('internalApiKeyMiddleware', () => {
  const original = process.env.INTERNAL_API_KEY;
  afterEach(() => {
    process.env.INTERNAL_API_KEY = original;
  });

  it('chama next() com a chave correta', () => {
    process.env.INTERNAL_API_KEY = 'segredo-123';
    const next = jest.fn();
    internalApiKeyMiddleware(req('segredo-123'), {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, '', 'errada', 'segredo-1234'])('lança 401 com chave %p', (key) => {
    process.env.INTERNAL_API_KEY = 'segredo-123';
    const next = jest.fn();
    expect(() => internalApiKeyMiddleware(req(key), {} as Response, next)).toThrow(
      expect.objectContaining({ statusCode: 401 }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('lança 503 quando INTERNAL_API_KEY não está configurada (fail closed)', () => {
    delete process.env.INTERNAL_API_KEY;
    expect(() => internalApiKeyMiddleware(req('qualquer'), {} as Response, jest.fn())).toThrow(
      expect.objectContaining({ statusCode: 503 }),
    );
  });
});
