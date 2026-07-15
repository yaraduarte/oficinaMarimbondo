import { Router } from 'express';
import { ClientController } from '../controllers/ClientController';
import { CreateClientUseCase } from '../../../application/use-cases/client/CreateClientUseCase';
import { GetClientUseCase } from '../../../application/use-cases/client/GetClientUseCase';
import { ListClientsUseCase } from '../../../application/use-cases/client/ListClientsUseCase';
import { UpdateClientUseCase } from '../../../application/use-cases/client/UpdateClientUseCase';
import { DeleteClientUseCase } from '../../../application/use-cases/client/DeleteClientUseCase';
import { TypeORMClientRepository } from '../../database/repositories/TypeORMClientRepository';
import { AppDataSource } from '../../database/data-source';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

const clientRepository = new TypeORMClientRepository(AppDataSource);
const clientController = new ClientController(
  new CreateClientUseCase(clientRepository),
  new GetClientUseCase(clientRepository),
  new ListClientsUseCase(clientRepository),
  new UpdateClientUseCase(clientRepository),
  new DeleteClientUseCase(clientRepository),
);

router.use(authMiddleware);

/**
 * @swagger
 * /api/clients:
 *   get:
 *     summary: Listar clientes
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de clientes paginada
 */
router.get('/', clientController.list);

/**
 * @swagger
 * /api/clients/{id}:
 *   get:
 *     summary: Buscar cliente por ID
 *     tags: [Clients]
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
 *         description: Cliente encontrado
 *       404:
 *         description: Cliente não encontrado
 */
router.get('/:id', clientController.getById);

/**
 * @swagger
 * /api/clients:
 *   post:
 *     summary: Criar cliente
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, cpfCnpj, email, phone]
 *             properties:
 *               name:
 *                 type: string
 *                 example: João Silva
 *               cpfCnpj:
 *                 type: string
 *                 example: "111.444.777-35"
 *               email:
 *                 type: string
 *                 example: joao@email.com
 *               phone:
 *                 type: string
 *                 example: "11999887766"
 *     responses:
 *       201:
 *         description: Cliente criado — copie o `data.id` para usar no cadastro de veículo
 *       409:
 *         description: CPF/CNPJ ou e-mail já cadastrado
 *       422:
 *         description: CPF/CNPJ inválido
 */
router.post('/', clientController.create);

/**
 * @swagger
 * /api/clients/{id}:
 *   put:
 *     summary: Atualizar cliente
 *     tags: [Clients]
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
 *                 example: João Silva Atualizado
 *               email:
 *                 type: string
 *                 example: joao.novo@email.com
 *               phone:
 *                 type: string
 *                 example: "11988887777"
 *     responses:
 *       200:
 *         description: Cliente atualizado com sucesso
 *       404:
 *         description: Cliente não encontrado
 */
router.put('/:id', clientController.update);

/**
 * @swagger
 * /api/clients/{id}:
 *   delete:
 *     summary: Remover cliente (soft delete)
 *     tags: [Clients]
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
 *         description: Cliente removido com sucesso
 *       404:
 *         description: Cliente não encontrado
 */
router.delete('/:id', clientController.delete);

export default router;
