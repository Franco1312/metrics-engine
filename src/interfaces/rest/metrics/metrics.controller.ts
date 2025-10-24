import { Request, Response } from 'express';
import { MetricsService } from './metrics.service.js';
import { logger } from '@/infrastructure/log/logger.js';
import { SERVER } from '@/infrastructure/log/log-events.js';
import { GetMetricPointsSchema, GetLatestMetricsSchema } from './metrics.validation.js';

export class MetricsController {
  constructor(private metricsService: MetricsService) {}

  async getMetricPoints(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = GetMetricPointsSchema.parse({
        metricId: req.params.metricId,
        from: req.query.from,
        to: req.query.to,
        limit: req.query.limit,
      });

      const points = await this.metricsService.getPoints(validatedData);

      res.json({
        metric_id: validatedData.metricId,
        points: points.map(point => ({
          ts: point.ts,
          value: point.value,
        })),
        count: points.length,
      });
    } catch (error) {
      logger.error({
        event: SERVER.ERROR,
        msg: 'Failed to get metric points',
        err: error as Error,
        data: { metricId: req.params.metricId },
      });

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getLatestMetrics(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = GetLatestMetricsSchema.parse(req.query);
      const metricIds = validatedData.ids
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);

      if (metricIds.length === 0) {
        res.status(400).json({ error: 'At least one metric ID is required' });
        return;
      }

      const result = await this.metricsService.getLatest({
        metricIds,
      });

      res.json({
        items: result.items,
        missing: result.missing,
      });
    } catch (error) {
      logger.error({
        event: SERVER.ERROR,
        msg: 'Failed to get latest metrics',
        err: error as Error,
        data: { ids: req.query.ids },
      });

      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
