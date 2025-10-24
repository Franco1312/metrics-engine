import { EnvironmentConfig } from '@/infrastructure/config/types';

export const localConfig: EnvironmentConfig = {
  sourceDatabase: {
    url: 'postgresql://user:pass@localhost:5433/ingestor',
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  targetDatabase: {
    url: 'postgresql://metrics_user:metrics_password@localhost:5434/metrics_engine',
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
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
