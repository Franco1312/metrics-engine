import { MetricsRepository } from '@/infrastructure/db/metricsRepo.js';
import { logger } from '@/infrastructure/log/logger.js';
import { SERVER } from '@/infrastructure/log/log-events.js';

export interface GetPointsRequest {
  metricId: string;
  from?: string | undefined;
  to?: string | undefined;
  limit?: number;
}

export interface GetLatestRequest {
  metricIds: string[];
}

export class MetricsService {
  constructor(private metricsRepository: MetricsRepository) {}

  async getPoints(request: GetPointsRequest) {
    logger.info({
      event: SERVER.INIT,
      msg: 'Getting metric points',
      data: { metricId: request.metricId },
    });

    try {
      const exists = await this.metricsRepository.metricExists(request.metricId);
      if (!exists) {
        throw new Error(`Metric ${request.metricId} not found`);
      }

      const points = await this.metricsRepository.getMetricPoints(
        request.metricId,
        request.from,
        request.to,
        request.limit || 500
      );

      logger.info({
        event: SERVER.FINISHED,
        msg: 'Metric points retrieved successfully',
        data: {
          metricId: request.metricId,
          count: points.length,
        },
      });

      return points;
    } catch (error) {
      logger.error({
        event: SERVER.ERROR,
        msg: 'Failed to get metric points',
        err: error as Error,
        data: { metricId: request.metricId },
      });
      throw error;
    }
  }

  async getLatest(request: GetLatestRequest) {
    logger.info({
      event: SERVER.INIT,
      msg: 'Getting latest metrics',
      data: { metricIds: request.metricIds },
    });

    try {
      const result = await this.metricsRepository.getLatestMetrics(request.metricIds);

      logger.info({
        event: SERVER.FINISHED,
        msg: 'Latest metrics retrieved successfully',
        data: {
          requested: request.metricIds.length,
          found: result.items.length,
          missing: result.missing.length,
        },
      });

      return result;
    } catch (error) {
      logger.error({
        event: SERVER.ERROR,
        msg: 'Failed to get latest metrics',
        err: error as Error,
        data: { metricIds: request.metricIds },
      });
      throw error;
    }
  }
}
