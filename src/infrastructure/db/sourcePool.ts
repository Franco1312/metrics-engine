import { Pool } from 'pg';
import { config } from '@/infrastructure/config/index.js';
import { logger } from '@/infrastructure/log/logger.js';
import { DATABASE } from '@/infrastructure/log/log-events.js';

class SourceDatabasePool {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.sourceDatabase.url,
      max: 10,
      idleTimeoutMillis: config.sourceDatabase.idleTimeoutMillis,
      connectionTimeoutMillis: config.sourceDatabase.connectionTimeoutMillis,
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
