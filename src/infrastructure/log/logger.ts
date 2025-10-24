import pino from 'pino';
import { PinoLogger } from '@/infrastructure/log/simpleLogger.js';
import { config } from '@/infrastructure/config/index.js';

const pinoInstance = pino({
  level: config.app.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

export const logger = new PinoLogger(pinoInstance);
