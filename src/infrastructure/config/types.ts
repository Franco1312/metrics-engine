export interface DatabaseConfig {
  url: string;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export interface MetricsConfig {
  backfillDays: number;
  updateDays: number;
  healthCheckDays: number;
  recomputeDays: number;
}

export interface AppConfig {
  timezone: string;
  logLevel: string;
  pageSize: number;
  httpPort: number;
  enableScheduler: boolean;
  metrics: MetricsConfig;
}

export interface EnvironmentConfig {
  sourceDatabase: DatabaseConfig;
  targetDatabase: DatabaseConfig;
  app: AppConfig;
}
