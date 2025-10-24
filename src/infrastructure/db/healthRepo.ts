import type { HealthRepository } from '@/domain/ports/healthRepository.js';
import { sourceDb } from '@/infrastructure/db/sourcePool.js';
import { targetDb } from '@/infrastructure/db/targetPool.js';
import { config } from '@/infrastructure/config/index.js';

export class HealthRepositoryImpl implements HealthRepository {
  async checkSourceDatabase(): Promise<boolean> {
    try {
      await sourceDb.healthCheck();
      return true;
    } catch {
      return false;
    }
  }

  async checkTargetDatabase(): Promise<boolean> {
    try {
      await targetDb.healthCheck();
      return true;
    } catch {
      return false;
    }
  }

  async getLastMetricTimestamp(): Promise<string | undefined> {
    try {
      const result = await targetDb.query(
        `SELECT MAX(ts) as last_ts FROM metrics.metrics_points WHERE ts >= current_date - INTERVAL '${config.app.metrics.healthCheckDays} days'`
      );

      return (result.rows[0] as { last_ts: string })?.last_ts;
    } catch {
      return undefined;
    }
  }
}
