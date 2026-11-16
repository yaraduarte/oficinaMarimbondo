import { Request, Response } from 'express';
import { CreateServiceOrderUseCase } from '../../../application/use-cases/service-order/CreateServiceOrderUseCase';
import { GetServiceOrderStatusUseCase } from '../../../application/use-cases/service-order/GetServiceOrderStatusUseCase';
import { ListServiceOrdersUseCase } from '../../../application/use-cases/service-order/ListServiceOrdersUseCase';
import { ApproveQuoteUseCase } from '../../../application/use-cases/service-order/ApproveQuoteUseCase';
import { UpdateServiceOrderStatusUseCase } from '../../../application/use-cases/service-order/UpdateServiceOrderStatusUseCase';
import { SagaOrchestrator } from '../../../application/saga/SagaOrchestrator';

export class ServiceOrderController {
  constructor(
    private readonly createServiceOrderUseCase: CreateServiceOrderUseCase,
    private readonly getServiceOrderStatusUseCase: GetServiceOrderStatusUseCase,
    private readonly listServiceOrdersUseCase: ListServiceOrdersUseCase,
    private readonly approveQuoteUseCase: ApproveQuoteUseCase,
    private readonly updateServiceOrderStatusUseCase: UpdateServiceOrderStatusUseCase,
    private readonly sagaOrchestrator?: SagaOrchestrator,
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const result = await this.createServiceOrderUseCase.execute(req.body);
    let saga: { id: string; status: string } | null = null;
    if (this.sagaOrchestrator) {
      try {
        const started = await this.sagaOrchestrator.start(result);
        saga = { id: started.id, status: started.status };
      } catch (err) {
        // A OS já foi gravada; a saga pode ser reiniciada depois sem duplicar (start é idempotente)
        console.error('[Saga] Falha ao iniciar a saga da OS', result.id, err);
      }
    }
    res.status(201).json({ status: 'success', data: result, saga });
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

  getSaga = async (req: Request, res: Response): Promise<void> => {
    if (!this.sagaOrchestrator) {
      res.status(404).json({ status: 'error', message: 'Saga não habilitada' });
      return;
    }
    const saga = await this.sagaOrchestrator.getByServiceOrder(req.params.id as string);
    res.status(200).json({ status: 'success', data: saga });
  };
}
