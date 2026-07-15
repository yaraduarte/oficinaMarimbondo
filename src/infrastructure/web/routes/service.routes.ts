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
 *     responses:
 *       200:
 *         description: Lista de serviços
 */
router.get('/', serviceController.list);

/**
 * @swagger
 * /api/services/{id}:
 *   get:
 *     summary: Buscar serviço por ID
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Serviço encontrado
 *       404:
 *         description: Serviço não encontrado
 */
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
 *             required: [name, price, estimatedHours]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Troca de óleo
 *               description:
 *                 type: string
 *                 example: Troca completa com filtro
 *               price:
 *                 type: number
 *                 example: 80.00
 *               estimatedHours:
 *                 type: number
 *                 example: 1
 *     responses:
 *       201:
 *         description: Serviço cadastrado com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post('/', serviceController.create);

/**
 * @swagger
 * /api/services/{id}:
 *   put:
 *     summary: Atualizar serviço
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
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
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               estimatedHours:
 *                 type: number
 *     responses:
 *       200:
 *         description: Serviço atualizado
 *       404:
 *         description: Serviço não encontrado
 */
router.put('/:id', serviceController.update);

/**
 * @swagger
 * /api/services/{id}:
 *   delete:
 *     summary: Remover serviço
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Serviço removido
 *       404:
 *         description: Serviço não encontrado
 */
router.delete('/:id', serviceController.delete);

export default router;
