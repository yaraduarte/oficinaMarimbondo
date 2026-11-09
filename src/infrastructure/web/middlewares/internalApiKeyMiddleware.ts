import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { AppError } from '../../../shared/errors/AppError';

export const INTERNAL_API_KEY_HEADER = 'x-internal-api-key';

/**
 * Protege rotas /internal/* (chamadas serviço-a-serviço).
 * Sem INTERNAL_API_KEY configurada, as rotas internas ficam desabilitadas (fail closed).
 */
export function internalApiKeyMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) {
    throw new AppError('Rotas internas desabilitadas', 503);
  }

  const received = req.header(INTERNAL_API_KEY_HEADER) ?? '';
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError('Chave interna inválida', 401);
  }
  next();
}
