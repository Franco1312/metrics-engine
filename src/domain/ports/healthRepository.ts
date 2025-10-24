export interface HealthRepository {
  checkSourceDatabase(): Promise<boolean>;
  checkTargetDatabase(): Promise<boolean>;
  getLastMetricTimestamp(): Promise<string | undefined>;
}
