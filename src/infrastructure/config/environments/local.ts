import { EnvironmentConfig } from '@/infrastructure/config/types';

export const localConfig: EnvironmentConfig = {
  sourceDatabase: {
    url: process.env.SOURCE_DB_URL || 'postgresql://user:pass@localhost:5433/ingestor',
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
  },
  targetDatabase: {
    url: process.env.TARGET_DB_URL || 'postgresql://metrics_user:metrics_password@localhost:5434/metrics_engine',
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
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
