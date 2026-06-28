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
 *     summary: Listar peças (com flag de estoque baixo)
 *     tags: [Parts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de peças com indicador de estoque baixo
 */
router.get('/', partController.list);
router.get('/:id', partController.getById);

/**
 * @swagger
 * /api/parts:
 *   post:
 *     summary: Cadastrar peça
 *     tags: [Parts]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', partController.create);
router.put('/:id', partController.update);
router.delete('/:id', partController.delete);

export default router;
