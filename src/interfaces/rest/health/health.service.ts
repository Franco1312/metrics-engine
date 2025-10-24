import type { HealthRepository } from '@/domain/ports/healthRepository.js';
import { config } from '@/infrastructure/config/index.js';
import { logger } from '@/infrastructure/log/logger.js';
import { SERVER } from '@/infrastructure/log/log-events.js';
import { DateService } from '@/domain/utils/dateService.js';

export interface HealthStatus {
  status: string;
  timestamp: string;
  timezone: string;
  databases: {
    source: boolean;
    target: boolean;
  };
  lastMetricTs?: string;
}

export class HealthService {
  constructor(private healthRepository: HealthRepository) {}

  async getHealthStatus(): Promise<HealthStatus> {
    logger.info({
      event: SERVER.INIT,
      msg: 'Starting health check',
    });

    try {
      const [sourceHealthy, targetHealthy] = await Promise.all([
        this.healthRepository.checkSourceDatabase(),
        this.healthRepository.checkTargetDatabase(),
      ]);

      let lastMetricTs: string | undefined;
      if (targetHealthy) {
        lastMetricTs = await this.healthRepository.getLastMetricTimestamp();
      }

      const health: HealthStatus = {
        status: sourceHealthy && targetHealthy ? 'healthy' : 'degraded',
        timestamp: DateService.getToday(),
        timezone: config.app.timezone,
        databases: {
          source: sourceHealthy,
          target: targetHealthy,
        },
        ...(lastMetricTs && { lastMetricTs }),
      };

      logger.info({
        event: SERVER.FINISHED,
        msg: 'Health check completed',
        data: { status: health.status },
      });

      return health;
    } catch (error) {
      logger.error({
        event: SERVER.ERROR,
        msg: 'Health check failed',
        err: error as Error,
      });

      return {
        status: 'unhealthy',
        timestamp: DateService.getToday(),
        timezone: config.app.timezone,
        databases: {
          source: false,
          target: false,
        },
      };
    }
  }
}
