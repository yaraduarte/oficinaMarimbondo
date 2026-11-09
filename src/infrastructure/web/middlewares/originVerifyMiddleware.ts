import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { AppError } from '../../../shared/errors/AppError';

export const ORIGIN_VERIFY_HEADER = 'x-origin-verify';

/** Caminhos acessados diretamente pelo kubelet (probes), sem passar pelo Gateway. */
const EXEMPT_PATHS = new Set(['/health']);

/**
 * Garante que a requisição veio do API Gateway: o Gateway injeta o header
 * x-origin-verify com um segredo compartilhado, e chamadas diretas ao IP da EC2 são recusadas.
 *
 * Desabilitado quando ORIGIN_VERIFY_SECRET não está definida (dev local, homologação interna).
 */
export function originVerifyMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const expected = process.env.ORIGIN_VERIFY_SECRET;
  if (!expected || EXEMPT_PATHS.has(req.path)) {
    next();
    return;
  }

  const received = Buffer.from(req.header(ORIGIN_VERIFY_HEADER) ?? '');
  const secret = Buffer.from(expected);
  if (received.length !== secret.length || !timingSafeEqual(received, secret)) {
    throw new AppError('Acesso permitido somente via API Gateway', 403);
  }
  next();
}
