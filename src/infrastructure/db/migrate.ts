import { targetDb } from '@/infrastructure/db/targetPool.js';
import { logger } from '@/infrastructure/log/logger.js';
import { DATABASE } from '@/infrastructure/log/log-events.js';

async function createMetricsTable(): Promise<void> {
  logger.info({
    event: DATABASE.QUERY,
    msg: 'Creating metrics_points table',
  });

  await targetDb.query(`
    CREATE TABLE IF NOT EXISTS metrics_points (
      metric_id TEXT NOT NULL,
      ts DATE NOT NULL,
      value NUMERIC NOT NULL,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (metric_id, ts)
    );
  `);

  await targetDb.query(`
    CREATE INDEX IF NOT EXISTS idx_metrics_points_metric_id_ts 
    ON metrics_points(metric_id, ts);
  `);

  await targetDb.query(`
    CREATE OR REPLACE FUNCTION update_metrics_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  await targetDb.query(`
    DROP TRIGGER IF EXISTS update_metrics_points_updated_at ON metrics_points;
    CREATE TRIGGER update_metrics_points_updated_at
        BEFORE UPDATE ON metrics_points
        FOR EACH ROW
        EXECUTE FUNCTION update_metrics_updated_at_column();
  `);

  logger.info({
    event: DATABASE.QUERY,
    msg: 'Metrics table and triggers created successfully',
  });
}

async function main(): Promise<void> {
  try {
    logger.info({
      event: DATABASE.INIT,
      msg: 'Starting database migration',
    });

    await createMetricsTable();

    logger.info({
      event: DATABASE.INIT,
      msg: 'Database migration completed successfully',
    });

    process.exit(0);
  } catch (error) {
    logger.error({
      event: DATABASE.ERROR,
      msg: 'Database migration failed',
      err: error as Error,
    });
    process.exit(1);
  } finally {
    await targetDb.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
