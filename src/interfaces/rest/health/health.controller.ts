import type { Request, Response } from 'express';
import { HealthService } from './health.service.js';
import { logger } from '@/infrastructure/log/logger.js';
import { SERVER } from '@/infrastructure/log/log-events.js';

export class HealthController {
  constructor(private healthService: HealthService) {}

  async getHealth(req: Request, res: Response): Promise<void> {
    logger.info({
      event: SERVER.INIT,
      msg: 'Health endpoint requested',
    });

    try {
      const health = await this.healthService.getHealthStatus();

      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);

      logger.info({
        event: SERVER.FINISHED,
        msg: 'Health endpoint completed',
        data: { status: health.status, statusCode },
      });
    } catch (error) {
      logger.error({
        event: SERVER.ERROR,
        msg: 'Health endpoint failed',
        err: error as Error,
      });

      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
