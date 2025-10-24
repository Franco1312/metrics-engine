import { sourceDb } from '@/infrastructure/db/sourcePool.js';
import { targetDb } from '@/infrastructure/db/targetPool.js';
import { config } from '@/infrastructure/config/index.js';
import { logger } from '@/infrastructure/log/logger.js';
import { CLI } from '@/infrastructure/log/log-events.js';

export async function getHealthStatus(): Promise<{
  status: string;
  timestamp: string;
  timezone: string;
  db: boolean;
  lastMetricTs?: string;
}> {
  try {
    logger.info({
      event: CLI.HEALTH,
      msg: 'Health check requested',
    });

    const sourceDbHealthy = await sourceDb.healthCheck();
    const targetDbHealthy = await targetDb.healthCheck();
    const dbHealthy = sourceDbHealthy && targetDbHealthy;

    let lastMetricTs: string | undefined;
    if (dbHealthy) {
      try {
        const result = await targetDb.query(
          `SELECT MAX(ts) as last_ts FROM metrics_points WHERE ts >= current_date - INTERVAL '${config.app.metrics.healthCheckDays} days'`
        );
        lastMetricTs = (result.rows[0] as { last_ts: string })?.last_ts;
      } catch (error) {
        logger.error({
          event: CLI.HEALTH,
          msg: 'Failed to get last metric timestamp',
          err: error as Error,
        });
      }
    }

    return {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      timezone: config.app.timezone,
      db: dbHealthy,
      ...(lastMetricTs && { lastMetricTs }),
    };
  } catch (error) {
    logger.error({
      event: CLI.HEALTH,
      msg: 'Health check failed',
      err: error as Error,
    });

    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      timezone: config.app.timezone,
      db: false,
    };
  }
}
