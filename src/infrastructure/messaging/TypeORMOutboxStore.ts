import { DataSource } from 'typeorm';
import { IOutboxStore, OutboxRecord } from './OutboxRelay';

/** Mensagens "PROCESSING" há mais tempo que isso voltam a ser elegíveis (réplica caiu no meio). */
const STALE_CLAIM_SECONDS = 60;

interface OutboxRow {
  id: string;
  exchange: string;
  routing_key: string;
  envelope: OutboxRecord['envelope'];
  attempts: number;
}

/**
 * Implementação PostgreSQL do outbox para o relay.
 * O claim usa FOR UPDATE SKIP LOCKED: várias réplicas do os-service (HPA) podem rodar o relay
 * ao mesmo tempo sem publicar a mesma mensagem em paralelo.
 */
export class TypeORMOutboxStore implements IOutboxStore {
  constructor(private readonly dataSource: DataSource) {}

  async claimPending(limit: number): Promise<OutboxRecord[]> {
    const rows: OutboxRow[] = await this.dataSource.query(
      `UPDATE outbox_messages
          SET status = 'PROCESSING', claimed_at = now(), attempts = attempts + 1
        WHERE id IN (
          SELECT id FROM outbox_messages
           WHERE status = 'PENDING'
              OR (status = 'PROCESSING' AND claimed_at < now() - ($2 || ' seconds')::interval)
           ORDER BY created_at
           LIMIT $1
           FOR UPDATE SKIP LOCKED)
        RETURNING id, exchange, routing_key, envelope, attempts`,
      [limit, String(STALE_CLAIM_SECONDS)],
    );
    // O driver pg devolve [rows, count] para UPDATE ... RETURNING
    const list = Array.isArray(rows[0]) ? (rows[0] as unknown as OutboxRow[]) : rows;
    return list.map((r) => ({
      id: r.id,
      exchange: r.exchange,
      routingKey: r.routing_key,
      envelope: r.envelope,
      attempts: r.attempts,
    }));
  }

  async markPublished(id: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE outbox_messages SET status = 'PUBLISHED', published_at = now(), last_error = NULL WHERE id = $1`,
      [id],
    );
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE outbox_messages SET status = 'PENDING', claimed_at = NULL, last_error = $2 WHERE id = $1`,
      [id, error.slice(0, 1000)],
    );
  }
}
