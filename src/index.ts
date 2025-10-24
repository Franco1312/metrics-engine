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
  app.use('/api/health', healthRoutes);
  app.use('/api', metricsRoutes);
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDefinition));
  app.use(handleServerError);
  app.use(handleNotFound);

  return app;
}

function handleServerError(err: Error, req: express.Request, res: express.Response, next: express.NextFunction): void {
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
