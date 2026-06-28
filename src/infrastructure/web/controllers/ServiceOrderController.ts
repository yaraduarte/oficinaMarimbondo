import { Request, Response } from 'express';
import { CreateServiceOrderUseCase } from '../../../application/use-cases/service-order/CreateServiceOrderUseCase';
import { GetServiceOrderStatusUseCase } from '../../../application/use-cases/service-order/GetServiceOrderStatusUseCase';
import { ListServiceOrdersUseCase } from '../../../application/use-cases/service-order/ListServiceOrdersUseCase';
import { ApproveQuoteUseCase } from '../../../application/use-cases/service-order/ApproveQuoteUseCase';
import { UpdateServiceOrderStatusUseCase } from '../../../application/use-cases/service-order/UpdateServiceOrderStatusUseCase';

export class ServiceOrderController {
  constructor(
    private readonly createServiceOrderUseCase: CreateServiceOrderUseCase,
    private readonly getServiceOrderStatusUseCase: GetServiceOrderStatusUseCase,
    private readonly listServiceOrdersUseCase: ListServiceOrdersUseCase,
    private readonly approveQuoteUseCase: ApproveQuoteUseCase,
    private readonly updateServiceOrderStatusUseCase: UpdateServiceOrderStatusUseCase,
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const result = await this.createServiceOrderUseCase.execute(req.body);
    res.status(201).json({ status: 'success', data: result });
  };

  getStatus = async (req: Request, res: Response): Promise<void> => {
    const result = await this.getServiceOrderStatusUseCase.execute(req.params.id as string);
    res.status(200).json({ status: 'success', data: result });
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.listServiceOrdersUseCase.execute();
    res.status(200).json({ status: 'success', data: result });
  };

  approveQuote = async (req: Request, res: Response): Promise<void> => {
    const result = await this.approveQuoteUseCase.execute(req.params.id as string, req.body);
    res.status(200).json({ status: 'success', data: result });
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    const result = await this.updateServiceOrderStatusUseCase.execute(req.params.id as string, req.body);
    res.status(200).json({ status: 'success', data: result });
  };
}
