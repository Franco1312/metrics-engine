import { Router } from 'express';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { HealthRepositoryImpl } from '@/infrastructure/db/healthRepo.js';

const healthRoutes = Router();
const healthRepository = new HealthRepositoryImpl();
const healthService = new HealthService(healthRepository);
const healthController = new HealthController(healthService);

healthRoutes.get('/', (req, res) => healthController.getHealth(req, res));

export { healthRoutes };
