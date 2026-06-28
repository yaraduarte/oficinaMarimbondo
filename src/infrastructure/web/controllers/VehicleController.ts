import { Request, Response } from 'express';
import { CreateVehicleUseCase } from '../../../application/use-cases/vehicle/CreateVehicleUseCase';
import { GetVehicleUseCase } from '../../../application/use-cases/vehicle/GetVehicleUseCase';
import { ListVehiclesUseCase } from '../../../application/use-cases/vehicle/ListVehiclesUseCase';
import { UpdateVehicleUseCase } from '../../../application/use-cases/vehicle/UpdateVehicleUseCase';
import { DeleteVehicleUseCase } from '../../../application/use-cases/vehicle/DeleteVehicleUseCase';

export class VehicleController {
  constructor(
    private readonly createVehicleUseCase: CreateVehicleUseCase,
    private readonly getVehicleUseCase: GetVehicleUseCase,
    private readonly listVehiclesUseCase: ListVehiclesUseCase,
    private readonly updateVehicleUseCase: UpdateVehicleUseCase,
    private readonly deleteVehicleUseCase: DeleteVehicleUseCase,
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const result = await this.createVehicleUseCase.execute(req.body);
    res.status(201).json({ status: 'success', data: result });
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const result = await this.getVehicleUseCase.execute(req.params.id as string);
    res.status(200).json({ status: 'success', data: result });
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const { clientId } = req.query;
    const result = await this.listVehiclesUseCase.execute(clientId as string | undefined);
    res.status(200).json({ status: 'success', data: result });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const result = await this.updateVehicleUseCase.execute(req.params.id as string, req.body);
    res.status(200).json({ status: 'success', data: result });
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.deleteVehicleUseCase.execute(req.params.id as string);
    res.status(204).send();
  };
}
