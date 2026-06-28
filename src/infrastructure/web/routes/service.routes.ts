import { Router } from 'express';
import { ServiceController } from '../controllers/ServiceController';
import { CreateServiceUseCase } from '../../../application/use-cases/service/CreateServiceUseCase';
import { GetServiceUseCase } from '../../../application/use-cases/service/GetServiceUseCase';
import { ListServicesUseCase } from '../../../application/use-cases/service/ListServicesUseCase';
import { UpdateServiceUseCase } from '../../../application/use-cases/service/UpdateServiceUseCase';
import { DeleteServiceUseCase } from '../../../application/use-cases/service/DeleteServiceUseCase';
import { TypeORMServiceRepository } from '../../database/repositories/TypeORMServiceRepository';
import { AppDataSource } from '../../database/data-source';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

const serviceRepository = new TypeORMServiceRepository(AppDataSource);
const serviceController = new ServiceController(
  new CreateServiceUseCase(serviceRepository),
  new GetServiceUseCase(serviceRepository),
  new ListServicesUseCase(serviceRepository),
  new UpdateServiceUseCase(serviceRepository),
  new DeleteServiceUseCase(serviceRepository),
);

router.use(authMiddleware);

/**
 * @swagger
 * /api/services:
 *   get:
 *     summary: Listar serviços
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', serviceController.list);
router.get('/:id', serviceController.getById);

/**
 * @swagger
 * /api/services:
 *   post:
 *     summary: Cadastrar serviço
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, description, price, estimatedHours]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               estimatedHours:
 *                 type: number
 */
router.post('/', serviceController.create);
router.put('/:id', serviceController.update);
router.delete('/:id', serviceController.delete);

export default router;
