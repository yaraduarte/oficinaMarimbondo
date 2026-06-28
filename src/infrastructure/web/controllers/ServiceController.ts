import { Request, Response } from 'express';
import { CreateServiceUseCase } from '../../../application/use-cases/service/CreateServiceUseCase';
import { GetServiceUseCase } from '../../../application/use-cases/service/GetServiceUseCase';
import { ListServicesUseCase } from '../../../application/use-cases/service/ListServicesUseCase';
import { UpdateServiceUseCase } from '../../../application/use-cases/service/UpdateServiceUseCase';
import { DeleteServiceUseCase } from '../../../application/use-cases/service/DeleteServiceUseCase';

export class ServiceController {
  constructor(
    private readonly createServiceUseCase: CreateServiceUseCase,
    private readonly getServiceUseCase: GetServiceUseCase,
    private readonly listServicesUseCase: ListServicesUseCase,
    private readonly updateServiceUseCase: UpdateServiceUseCase,
    private readonly deleteServiceUseCase: DeleteServiceUseCase,
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const result = await this.createServiceUseCase.execute(req.body);
    res.status(201).json({ status: 'success', data: result });
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const result = await this.getServiceUseCase.execute(req.params.id as string);
    res.status(200).json({ status: 'success', data: result });
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.listServicesUseCase.execute();
    res.status(200).json({ status: 'success', data: result });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const result = await this.updateServiceUseCase.execute(req.params.id as string, req.body);
    res.status(200).json({ status: 'success', data: result });
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.deleteServiceUseCase.execute(req.params.id as string);
    res.status(204).send();
  };
}
