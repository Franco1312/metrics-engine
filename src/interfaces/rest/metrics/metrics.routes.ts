import { Router } from 'express';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';
import { MetricsRepository } from '@/infrastructure/db/metricsRepo.js';

const metricsRoutes = Router();
const metricsRepository = new MetricsRepository();
const metricsService = new MetricsService(metricsRepository);
const metricsController = new MetricsController(metricsService);

metricsRoutes.get('/v1/metrics/summary', (req, res) =>
  metricsController.getLatestMetrics(req, res)
);

metricsRoutes.get('/v1/metrics/:metricId', (req, res) =>
  metricsController.getMetricPoints(req, res)
);

export { metricsRoutes };
