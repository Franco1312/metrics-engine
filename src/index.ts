import { config } from '@/infrastructure/config/index.js';
import { logger } from '@/infrastructure/log/logger.js';
import { getHealthStatus } from '@/interfaces/rest/health.js';
import { sourceDb } from '@/infrastructure/db/sourcePool.js';
import { targetDb } from '@/infrastructure/db/targetPool.js';
import { createServer } from 'http';

async function startServer(): Promise<void> {
  logger.info({
    event: 'SERVER.INIT',
    msg: 'Starting Metrics Engine server',
    data: {
      timezone: config.app.timezone,
      logLevel: config.app.logLevel,
    },
  });

  server = createServer(async (req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      try {
        const health = await getHealthStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health));
      } catch (error) {
        logger.error({
          event: 'SERVER.ERROR',
          msg: 'Health check failed',
          err: error as Error,
        });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'Internal server error' }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: 'Not found' }));
    }
  });

  const port = config.app.httpPort;
  server.listen(port);
}

let server: ReturnType<typeof createServer> | null = null;

async function gracefulShutdown(): Promise<void> {
  logger.info({
    event: 'SERVER.SHUTDOWN',
    msg: 'Graceful shutdown initiated',
  });

  if (server) {
    server.close();
  }

  await Promise.all([sourceDb.close(), targetDb.close()]);

  logger.info({
    event: 'SERVER.SHUTDOWN',
    msg: 'Graceful shutdown completed',
  });

  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch(error => {
    logger.error({
      event: 'SERVER.ERROR',
      msg: 'Server startup failed',
      err: error,
    });
    process.exit(1);
  });
}
