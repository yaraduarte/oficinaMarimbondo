import { Router } from 'express';
import { ServiceOrderController } from '../controllers/ServiceOrderController';
import { CreateServiceOrderUseCase } from '../../../application/use-cases/service-order/CreateServiceOrderUseCase';
import { GetServiceOrderStatusUseCase } from '../../../application/use-cases/service-order/GetServiceOrderStatusUseCase';
import { ListServiceOrdersUseCase } from '../../../application/use-cases/service-order/ListServiceOrdersUseCase';
import { ApproveQuoteUseCase } from '../../../application/use-cases/service-order/ApproveQuoteUseCase';
import { UpdateServiceOrderStatusUseCase } from '../../../application/use-cases/service-order/UpdateServiceOrderStatusUseCase';
import { TypeORMServiceOrderRepository } from '../../database/repositories/TypeORMServiceOrderRepository';
import { TypeORMServiceRepository } from '../../database/repositories/TypeORMServiceRepository';
import { TypeORMPartRepository } from '../../database/repositories/TypeORMPartRepository';
import { TypeORMClientRepository } from '../../database/repositories/TypeORMClientRepository';
import { TypeORMVehicleRepository } from '../../database/repositories/TypeORMVehicleRepository';
import { NotificationService } from '../../notification/NotificationService';
import { AppDataSource } from '../../database/data-source';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

const serviceOrderRepository = new TypeORMServiceOrderRepository(AppDataSource);
const serviceRepository = new TypeORMServiceRepository(AppDataSource);
const partRepository = new TypeORMPartRepository(AppDataSource);
const clientRepository = new TypeORMClientRepository(AppDataSource);
const vehicleRepository = new TypeORMVehicleRepository(AppDataSource);
const notificationService = new NotificationService();

const serviceOrderController = new ServiceOrderController(
  new CreateServiceOrderUseCase(
    serviceOrderRepository,
    serviceRepository,
    partRepository,
    clientRepository,
    vehicleRepository,
  ),
  new GetServiceOrderStatusUseCase(serviceOrderRepository),
  new ListServiceOrdersUseCase(serviceOrderRepository),
  new ApproveQuoteUseCase(serviceOrderRepository, clientRepository, notificationService),
  new UpdateServiceOrderStatusUseCase(serviceOrderRepository, clientRepository, notificationService),
);

/**
 * @swagger
 * /api/service-orders/{id}/status:
 *   get:
 *     summary: Consultar status da OS (público)
 *     tags: [Service Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status atual da ordem de serviço
 *       404:
 *         description: OS não encontrada
 */
router.get('/:id/status', serviceOrderController.getStatus);

/**
 * @swagger
 * /api/service-orders/{id}/approve:
 *   post:
 *     summary: Aprovar ou rejeitar orçamento (público)
 *     tags: [Service Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [decision]
 *             properties:
 *               decision:
 *                 type: string
 *                 enum: [approved, rejected]
 *                 example: approved
 *     responses:
 *       200:
 *         description: Decisão registrada com sucesso
 *       404:
 *         description: OS não encontrada
 *       422:
 *         description: OS não está aguardando aprovação
 */
router.post('/:id/approve', serviceOrderController.approveQuote);

// Protected routes
router.use(authMiddleware);

/**
 * @swagger
 * /api/service-orders:
 *   get:
 *     summary: Listar ordens de serviço ativas (ordenadas por prioridade)
 *     tags: [Service Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de OS ativas — EM_EXECUCAO > AGUARDANDO_APROVACAO > EM_DIAGNOSTICO > RECEBIDA
 */
router.get('/', serviceOrderController.list);

/**
 * @swagger
 * /api/service-orders:
 *   post:
 *     summary: Criar ordem de serviço
 *     tags: [Service Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientId, vehicleId, serviceIds]
 *             properties:
 *               clientId:
 *                 type: string
 *               vehicleId:
 *                 type: string
 *               serviceIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               parts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     partId:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *               notes:
 *                 type: string
 *                 example: Cliente relatou barulho no motor
 *     responses:
 *       201:
 *         description: OS criada com sucesso — o campo `data.id` é o ID para usar nos próximos endpoints
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: ID da OS — use nos endpoints de status e aprovação
 *                     orderNumber:
 *                       type: string
 *                       example: OS-2026-001
 *                     status:
 *                       type: string
 *                       example: RECEBIDA
 *                     budget:
 *                       type: number
 *                       example: 125.90
 *       404:
 *         description: Cliente, veículo ou serviço não encontrado
 *       422:
 *         description: Veículo não pertence ao cliente ou estoque insuficiente
 */
router.post('/', serviceOrderController.create);

/**
 * @swagger
 * /api/service-orders/{id}/status:
 *   patch:
 *     summary: Avançar status da OS
 *     tags: [Service Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [RECEBIDA, EM_DIAGNOSTICO, AGUARDANDO_APROVACAO, EM_EXECUCAO, FINALIZADA, ENTREGUE]
 *                 example: EM_DIAGNOSTICO
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da OS retornado no POST de criação
 *     responses:
 *       200:
 *         description: Status atualizado — notificação enviada por e-mail e WhatsApp
 *       404:
 *         description: OS não encontrada
 *       422:
 *         description: Transição de status inválida
 */
router.patch('/:id/status', serviceOrderController.updateStatus);

export default router;
