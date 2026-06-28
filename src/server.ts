import 'dotenv/config';
import app from './app';
import { AppDataSource } from './infrastructure/database/data-source';

const PORT = process.env.PORT ?? 3000;

AppDataSource.initialize()
  .then(() => {
    console.log('[Database] Conectado ao PostgreSQL com sucesso');

    app.listen(PORT, () => {
      console.log(`[Server] Oficina Marimb0ndo API rodando na porta ${PORT}`);
      console.log(`[Server] Swagger disponível em http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((err) => {
    console.error('[Database] Falha ao conectar ao PostgreSQL:', err);
    process.exit(1);
  });
