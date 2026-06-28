import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Permite forçar synchronize via variável de ambiente (útil no K8s sem migrations)
const shouldSynchronize = process.env.DB_SYNCHRONIZE === 'true' || !isProduction;

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASS ?? 'postgres123',
  database: process.env.DB_NAME ?? 'oficina_db',
  synchronize: shouldSynchronize,
  logging: !isProduction,
  entities: [__dirname + '/entities/*.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  subscribers: [],
  ssl: false,
});
