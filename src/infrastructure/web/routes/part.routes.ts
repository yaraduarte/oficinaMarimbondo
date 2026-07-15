import { Router } from 'express';
import { PartController } from '../controllers/PartController';
import { CreatePartUseCase } from '../../../application/use-cases/part/CreatePartUseCase';
import { GetPartUseCase } from '../../../application/use-cases/part/GetPartUseCase';
import { ListPartsUseCase } from '../../../application/use-cases/part/ListPartsUseCase';
import { UpdatePartUseCase } from '../../../application/use-cases/part/UpdatePartUseCase';
import { DeletePartUseCase } from '../../../application/use-cases/part/DeletePartUseCase';
import { TypeORMPartRepository } from '../../database/repositories/TypeORMPartRepository';
import { AppDataSource } from '../../database/data-source';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

const partRepository = new TypeORMPartRepository(AppDataSource);
const partController = new PartController(
  new CreatePartUseCase(partRepository),
  new GetPartUseCase(partRepository),
  new ListPartsUseCase(partRepository),
  new UpdatePartUseCase(partRepository),
  new DeletePartUseCase(partRepository),
);

router.use(authMiddleware);

/**
 * @swagger
 * /api/parts:
 *   get:
 *     summary: Listar peças
 *     tags: [Parts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de peças com indicador de estoque baixo
 */
router.get('/', partController.list);

/**
 * @swagger
 * /api/parts/{id}:
 *   get:
 *     summary: Buscar peça por ID
 *     tags: [Parts]
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
 *         description: Peça encontrada
 *       404:
 *         description: Peça não encontrada
 */
router.get('/:id', partController.getById);

/**
 * @swagger
 * /api/parts:
 *   post:
 *     summary: Cadastrar peça
 *     tags: [Parts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, unitPrice, stockQuantity, minStockAlert]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Filtro de óleo
 *               description:
 *                 type: string
 *                 example: Filtro Mann W712/75
 *               unitPrice:
 *                 type: number
 *                 example: 45.90
 *               stockQuantity:
 *                 type: integer
 *                 example: 20
 *               minStockAlert:
 *                 type: integer
 *                 example: 5
 *     responses:
 *       201:
 *         description: Peça cadastrada com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post('/', partController.create);

/**
 * @swagger
 * /api/parts/{id}:
 *   put:
 *     summary: Atualizar peça
 *     tags: [Parts]
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
 *               unitPrice:
 *                 type: number
 *               stockQuantity:
 *                 type: integer
 *               minStockAlert:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Peça atualizada
 *       404:
 *         description: Peça não encontrada
 */
router.put('/:id', partController.update);

/**
 * @swagger
 * /api/parts/{id}:
 *   delete:
 *     summary: Remover peça
 *     tags: [Parts]
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
 *         description: Peça removida
 *       404:
 *         description: Peça não encontrada
 */
router.delete('/:id', partController.delete);

export default router;
