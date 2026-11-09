import { Router } from 'express';
import { InternalController } from '../controllers/InternalController';
import { GetClientAuthInfoUseCase } from '../../../application/use-cases/internal/GetClientAuthInfoUseCase';
import { TypeORMClientRepository } from '../../database/repositories/TypeORMClientRepository';
import { AppDataSource } from '../../database/data-source';
import { internalApiKeyMiddleware } from '../middlewares/internalApiKeyMiddleware';

const router = Router();

const controller = new InternalController(
  new GetClientAuthInfoUseCase(new TypeORMClientRepository(AppDataSource)),
);

router.use(internalApiKeyMiddleware);

/**
 * @swagger
 * /internal/clients/by-cpf/{cpfCnpj}:
 *   get:
 *     summary: "[Interno] Dados de autenticação do cliente por CPF/CNPJ"
 *     description: Usado pela Lambda de autenticação (não acessa o banco diretamente). Protegido pelo header x-internal-api-key; não é exposto no API Gateway público.
 *     tags: [Internal]
 *     security:
 *       - internalApiKey: []
 *     parameters:
 *       - in: path
 *         name: cpfCnpj
 *         required: true
 *         schema:
 *           type: string
 *           example: "11144477735"
 *     responses:
 *       200:
 *         description: Cliente encontrado (inclui status e flag active)
 *       401:
 *         description: Chave interna ausente ou inválida
 *       404:
 *         description: Cliente não encontrado ou removido
 *       422:
 *         description: CPF/CNPJ inválido
 */
router.get('/clients/by-cpf/:cpfCnpj', controller.getClientAuthInfo);

export default router;
