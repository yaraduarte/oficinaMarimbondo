import { Request, Response } from 'express';
import { GetClientAuthInfoUseCase } from '../../../application/use-cases/internal/GetClientAuthInfoUseCase';

export class InternalController {
  constructor(private readonly getClientAuthInfoUseCase: GetClientAuthInfoUseCase) {}

  getClientAuthInfo = async (req: Request, res: Response): Promise<void> => {
    const result = await this.getClientAuthInfoUseCase.execute(req.params.cpfCnpj as string);
    res.status(200).json({ status: 'success', data: result });
  };
}
