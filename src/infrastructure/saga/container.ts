import { SagaOrchestrator, Logger } from '../../application/saga/SagaOrchestrator';
import { AppDataSource } from '../database/data-source';
import { TypeORMSagaUnitOfWork } from '../database/repositories/TypeORMSagaPersistence';
import { TypeORMClientRepository } from '../database/repositories/TypeORMClientRepository';

const consoleLogger: Logger = {
  info: (msg, meta) => console.log(`[Saga] ${msg}`, meta ? JSON.stringify(meta) : ''),
  warn: (msg, meta) => console.warn(`[Saga] ${msg}`, meta ? JSON.stringify(meta) : ''),
};

let orchestrator: SagaOrchestrator | null = null;

/** Instância única do orquestrador, usada pelas rotas HTTP e pelo consumidor do RabbitMQ. */
export function getSagaOrchestrator(): SagaOrchestrator {
  if (!orchestrator) {
    orchestrator = new SagaOrchestrator(
      new TypeORMSagaUnitOfWork(AppDataSource),
      new TypeORMClientRepository(AppDataSource),
      undefined,
      undefined,
      consoleLogger,
    );
  }
  return orchestrator;
}
