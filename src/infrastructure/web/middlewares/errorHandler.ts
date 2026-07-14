import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../shared/errors/AppError';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
    return;
  }

  // JSON parse error from body-parser
  if ((err as any).type === 'entity.parse.failed') {
    res.status(400).json({
      status: 'error',
      message: 'JSON inválido no corpo da requisição',
    });
    return;
  }

  console.error('[Unhandled Error]', err);
  res.status(500).json({
    status: 'error',
    message: 'Erro interno do servidor',
  });
}
