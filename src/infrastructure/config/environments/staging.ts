import { EnvironmentConfig } from '@/infrastructure/config/types';

export const stagingConfig: EnvironmentConfig = {
  app: {
    timezone: process.env.APP_TIMEZONE || 'America/Argentina/Buenos_Aires',
    logLevel: process.env.LOG_LEVEL || 'info',
    pageSize: parseInt(process.env.APP_PAGE_SIZE || '1000', 10),
    httpPort: parseInt(process.env.HTTP_PORT || '3000', 10),
    enableScheduler: process.env.ENABLE_SCHEDULER === 'true',
    metrics: {
      backfillDays: 90,
      updateDays: 30,
      healthCheckDays: 1,
      recomputeDays: parseInt(process.env.RECOMPUTE_DAYS || '30', 10),
    },
  },
};
