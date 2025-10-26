import { Router } from 'express';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';
import { MetricsRepository } from '@/infrastructure/db/metricsRepo.js';
import { MetricsDefinitionsRepository } from '@/infrastructure/db/metricsDefinitionsRepo.js';

const metricsRoutes = Router();
const metricsRepository = new MetricsRepository();
const definitionsRepository = new MetricsDefinitionsRepository();
const metricsService = new MetricsService(metricsRepository, definitionsRepository);
const metricsController = new MetricsController(metricsService);

metricsRoutes.get('/v1/metrics', (req, res) => metricsController.getMetricsList(req, res));

metricsRoutes.get('/v1/metrics/summary', (req, res) =>
  metricsController.getLatestMetrics(req, res)
);

metricsRoutes.get('/v1/metrics/:metricId', (req, res) =>
  metricsController.getMetricPoints(req, res)
);

export { metricsRoutes };
