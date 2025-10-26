import { EnvironmentConfig } from '@/infrastructure/config/types';

export const localConfig: EnvironmentConfig = {
  app: {
    timezone: 'America/Argentina/Buenos_Aires',
    logLevel: 'info',
    pageSize: 1000,
    httpPort: 3000,
    enableScheduler: true,
    metrics: {
      backfillDays: 180,
      updateDays: 30,
      healthCheckDays: 1,
      recomputeDays: 30,
    },
  },
};
