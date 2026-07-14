import 'reflect-metadata';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { swaggerSpec } from './infrastructure/web/swagger/swaggerConfig';
import { errorHandler } from './infrastructure/web/middlewares/errorHandler';

import authRoutes from './infrastructure/web/routes/auth.routes';
import clientRoutes from './infrastructure/web/routes/client.routes';
import vehicleRoutes from './infrastructure/web/routes/vehicle.routes';
import partRoutes from './infrastructure/web/routes/part.routes';
import serviceRoutes from './infrastructure/web/routes/service.routes';
import serviceOrderRoutes from './infrastructure/web/routes/serviceOrder.routes';

const app = express();

// Security & parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger docs (sem helmet para não bloquear assets/fetch do Swagger UI)
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: { docExpansion: 'list', defaultModelsExpandDepth: -1 },
  }),
);

// Aplica helmet nas rotas de API (após o Swagger)
app.use(helmet());

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/parts', partRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/service-orders', serviceOrderRoutes);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
