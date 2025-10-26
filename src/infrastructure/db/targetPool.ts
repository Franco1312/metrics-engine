import { Pool } from 'pg';
import { config } from '@/infrastructure/config/index.js';
import { logger } from '@/infrastructure/log/logger.js';
import { DATABASE } from '@/infrastructure/log/log-events.js';

class TargetDatabasePool {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.targetDatabase.url,
      max: 20, // Aumentar para AWS Aurora
      min: 2, // Mantener conexiones mínimas
      idleTimeoutMillis: config.targetDatabase.idleTimeoutMillis,
      connectionTimeoutMillis: config.targetDatabase.connectionTimeoutMillis,
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
        msg: 'Target database pool error',
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
      msg: 'Target database pool closed',
    });
  }
}

export const targetDb = new TargetDatabasePool();
