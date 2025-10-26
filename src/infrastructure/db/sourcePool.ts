import { Pool } from 'pg';
import { logger } from '@/infrastructure/log/logger.js';
import { DATABASE } from '@/infrastructure/log/log-events.js';

class SourceDatabasePool {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.SOURCE_DB_URL!,
      max: 20, // Aumentar para AWS Aurora
      min: 2, // Mantener conexiones mínimas
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
      keepAlive: true, // Mantener conexiones vivas
      keepAliveInitialDelayMillis: 10000, // 10 segundos
      ssl: {
        rejectUnauthorized: false, // Para AWS Aurora RDS
      },
    });

    this.pool.on('connect', () => {});

    this.pool.on('error', err => {
      logger.error({
        event: DATABASE.ERROR,
        msg: 'Source database pool error',
        err,
      });
    });
  }

  async query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1 as health');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info({
      event: DATABASE.CLOSE,
      msg: 'Source database pool closed',
    });
  }
}

export const sourceDb = new SourceDatabasePool();
