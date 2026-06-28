import { Request, Response } from 'express';
import { CreatePartUseCase } from '../../../application/use-cases/part/CreatePartUseCase';
import { GetPartUseCase } from '../../../application/use-cases/part/GetPartUseCase';
import { ListPartsUseCase } from '../../../application/use-cases/part/ListPartsUseCase';
import { UpdatePartUseCase } from '../../../application/use-cases/part/UpdatePartUseCase';
import { DeletePartUseCase } from '../../../application/use-cases/part/DeletePartUseCase';

export class PartController {
  constructor(
    private readonly createPartUseCase: CreatePartUseCase,
    private readonly getPartUseCase: GetPartUseCase,
    private readonly listPartsUseCase: ListPartsUseCase,
    private readonly updatePartUseCase: UpdatePartUseCase,
    private readonly deletePartUseCase: DeletePartUseCase,
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const result = await this.createPartUseCase.execute(req.body);
    res.status(201).json({ status: 'success', data: result });
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const result = await this.getPartUseCase.execute(req.params.id as string);
    res.status(200).json({ status: 'success', data: result });
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.listPartsUseCase.execute();
    res.status(200).json({ status: 'success', data: result });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const result = await this.updatePartUseCase.execute(req.params.id as string, req.body);
    res.status(200).json({ status: 'success', data: result });
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.deletePartUseCase.execute(req.params.id as string);
    res.status(204).send();
  };
}
