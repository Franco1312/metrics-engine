import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { config } from '@/infrastructure/config/index.js';
import { logger } from '@/infrastructure/log/logger.js';
import { sourceDb } from '@/infrastructure/db/sourcePool.js';
import { targetDb } from '@/infrastructure/db/targetPool.js';
import { SERVER } from '@/infrastructure/log/log-events.js';
import { healthRoutes } from '@/interfaces/rest/health/health.routes.js';
import { metricsRoutes } from '@/interfaces/rest/metrics/metrics.routes.js';
import { swaggerDefinition } from '@/infrastructure/swagger/swagger.config.js';

async function startServer(): Promise<void> {
  logger.info({
    event: SERVER.INIT,
    msg: 'Starting Metrics Engine server',
    data: {
      timezone: config.app.timezone,
      logLevel: config.app.logLevel,
    },
  });

  const app = createExpressApp();
  const httpServer = app.listen(config.app.httpPort);

  return new Promise((resolve, reject) => {
    httpServer.on('listening', () => {
      logger.info({
        event: SERVER.FINISHED,
        msg: 'Server listening on port',
        data: { port: config.app.httpPort },
      });
      resolve();
    });

    httpServer.on('error', error => {
      logger.error({
        event: SERVER.ERROR,
        msg: 'Server startup failed',
        err: error as Error,
      });
      reject(error);
    });
  });
}

function createExpressApp(): express.Application {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/', (req, res) => {
    res.json({
      service: 'Metrics Engine',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        health: '/api/health',
        metrics: '/api/v1/metrics',
        docs: '/api/docs',
      },
    });
  });

  app.get('/api/', (req, res) => {
    res.json({
      service: 'Metrics Engine API',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        health: '/api/health',
        metrics: '/api/v1/metrics',
        docs: '/api/docs',
      },
    });
  });

  app.get('/api/metrics/latest', async (req, res) => {
    try {
      const { MetricsRepository } = await import('@/infrastructure/db/metricsRepo.js');
      const metricsRepo = new MetricsRepository();

      const allMetrics = [
        'ratio.reserves_to_base',
        'delta.reserves_7d',
        'delta.base_30d',
        'fx.brecha_mep',
        'delta.reserves_5d',
        'mon.base_ampliada_ars',
      ];

      const result = await metricsRepo.getLatestMetrics(allMetrics);

      res.json({
        metrics: result.items,
        missing: result.missing,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({
        event: SERVER.ERROR,
        msg: 'Failed to get latest metrics',
        err: error as Error,
      });
      res.status(500).json({
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.use('/api/health', healthRoutes);
  app.use('/api', metricsRoutes);
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDefinition));
  app.use(handleServerError);
  app.use(handleNotFound);

  return app;
}

function handleServerError(
  err: Error,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  logger.error({
    event: SERVER.ERROR,
    msg: 'Unhandled server error',
    err,
    data: { path: req.path, method: req.method },
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
  });
}

function handleNotFound(req: express.Request, res: express.Response): void {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    timestamp: new Date().toISOString(),
  });
}

async function gracefulShutdown(): Promise<void> {
  logger.info({
    event: SERVER.INIT,
    msg: 'Graceful shutdown initiated',
  });

  await Promise.all([sourceDb.close(), targetDb.close()]);

  logger.info({
    event: SERVER.FINISHED,
    msg: 'Graceful shutdown completed',
  });

  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch(error => {
    logger.error({
      event: SERVER.ERROR,
      msg: 'Server startup failed',
      err: error as Error,
    });
    process.exit(1);
  });
}
