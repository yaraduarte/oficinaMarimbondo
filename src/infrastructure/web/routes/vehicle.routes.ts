import { Router } from 'express';
import { VehicleController } from '../controllers/VehicleController';
import { CreateVehicleUseCase } from '../../../application/use-cases/vehicle/CreateVehicleUseCase';
import { GetVehicleUseCase } from '../../../application/use-cases/vehicle/GetVehicleUseCase';
import { ListVehiclesUseCase } from '../../../application/use-cases/vehicle/ListVehiclesUseCase';
import { UpdateVehicleUseCase } from '../../../application/use-cases/vehicle/UpdateVehicleUseCase';
import { DeleteVehicleUseCase } from '../../../application/use-cases/vehicle/DeleteVehicleUseCase';
import { TypeORMVehicleRepository } from '../../database/repositories/TypeORMVehicleRepository';
import { TypeORMClientRepository } from '../../database/repositories/TypeORMClientRepository';
import { AppDataSource } from '../../database/data-source';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

const vehicleRepository = new TypeORMVehicleRepository(AppDataSource);
const clientRepository = new TypeORMClientRepository(AppDataSource);
const vehicleController = new VehicleController(
  new CreateVehicleUseCase(vehicleRepository, clientRepository),
  new GetVehicleUseCase(vehicleRepository),
  new ListVehiclesUseCase(vehicleRepository),
  new UpdateVehicleUseCase(vehicleRepository),
  new DeleteVehicleUseCase(vehicleRepository),
);

router.use(authMiddleware);

/**
 * @swagger
 * /api/vehicles:
 *   get:
 *     summary: Listar veículos
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de veículos
 */
router.get('/', vehicleController.list);

/**
 * @swagger
 * /api/vehicles/{id}:
 *   get:
 *     summary: Buscar veículo por ID
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', vehicleController.getById);

/**
 * @swagger
 * /api/vehicles:
 *   post:
 *     summary: Cadastrar veículo
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plate, brand, model, year, clientId]
 *             properties:
 *               plate:
 *                 type: string
 *                 example: ABC1D23
 *               brand:
 *                 type: string
 *               model:
 *                 type: string
 *               year:
 *                 type: integer
 *               clientId:
 *                 type: string
 */
router.post('/', vehicleController.create);

/**
 * @swagger
 * /api/vehicles/{id}:
 *   put:
 *     summary: Atualizar veículo
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', vehicleController.update);

/**
 * @swagger
 * /api/vehicles/{id}:
 *   delete:
 *     summary: Remover veículo
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', vehicleController.delete);

export default router;
