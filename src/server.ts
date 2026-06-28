import 'dotenv/config';
import app from './app';
import { AppDataSource } from './infrastructure/database/data-source';

const PORT = process.env.PORT ?? 3000;
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;

async function connectWithRetry(attempt = 1): Promise<void> {
  try {
    await AppDataSource.initialize();
    console.log('[Database] Conectado ao PostgreSQL com sucesso');
  } catch (err) {
    if (attempt >= MAX_RETRIES) {
      console.error(`[Database] Falha após ${MAX_RETRIES} tentativas:`, err);
      process.exit(1);
    }
    console.warn(`[Database] Tentativa ${attempt}/${MAX_RETRIES} falhou. Tentando novamente em ${RETRY_DELAY_MS / 1000}s...`);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return connectWithRetry(attempt + 1);
  }
}

connectWithRetry().then(() => {
  app.listen(PORT, () => {
    console.log(`[Server] Oficina Marimb0ndo API rodando na porta ${PORT}`);
    console.log(`[Server] Swagger disponível em http://localhost:${PORT}/api-docs`);
  });
});
