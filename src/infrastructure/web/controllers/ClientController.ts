import { Request, Response } from 'express';
import { CreateClientUseCase } from '../../../application/use-cases/client/CreateClientUseCase';
import { GetClientUseCase } from '../../../application/use-cases/client/GetClientUseCase';
import { ListClientsUseCase } from '../../../application/use-cases/client/ListClientsUseCase';
import { UpdateClientUseCase } from '../../../application/use-cases/client/UpdateClientUseCase';
import { DeleteClientUseCase } from '../../../application/use-cases/client/DeleteClientUseCase';

export class ClientController {
  constructor(
    private readonly createClientUseCase: CreateClientUseCase,
    private readonly getClientUseCase: GetClientUseCase,
    private readonly listClientsUseCase: ListClientsUseCase,
    private readonly updateClientUseCase: UpdateClientUseCase,
    private readonly deleteClientUseCase: DeleteClientUseCase,
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const result = await this.createClientUseCase.execute(req.body);
    res.status(201).json({ status: 'success', data: result });
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const result = await this.getClientUseCase.execute(req.params.id as string);
    res.status(200).json({ status: 'success', data: result });
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const { page, limit, name } = req.query;
    const result = await this.listClientsUseCase.execute({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
      name: name as string | undefined,
    });
    res.status(200).json({ status: 'success', data: result });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const result = await this.updateClientUseCase.execute(req.params.id as string, req.body);
    res.status(200).json({ status: 'success', data: result });
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.deleteClientUseCase.execute(req.params.id as string);
    res.status(204).send();
  };
}
