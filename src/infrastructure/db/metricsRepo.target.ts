import { targetDb } from '@/infrastructure/db/targetPool.js';

export interface MetricsPoint {
  metric_id: string;
  ts: string;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface TargetMetricsRepository {
  upsertMetricsPoints(points: MetricsPoint[]): Promise<void>;
  getMetricsPoints(metricId: string, fromDate: string, toDate: string): Promise<MetricsPoint[]>;
  getLastMetricTimestamp(metricId: string): Promise<string | null>;
}

export class TargetMetricsRepositoryImpl implements TargetMetricsRepository {
  async upsertMetricsPoints(points: MetricsPoint[]): Promise<void> {
    if (points.length === 0) {
      return;
    }

    const values = points
      .map((_, index) => {
        const baseIndex = index * 4;
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`;
      })
      .join(', ');

    const query = `
      INSERT INTO metrics_points (metric_id, ts, value, metadata)
      VALUES ${values}
      ON CONFLICT (metric_id, ts) 
      DO UPDATE SET 
        value = EXCLUDED.value,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `;

    const params = points.flatMap(point => [
      point.metric_id,
      point.ts,
      point.value,
      point.metadata || null,
    ]);

    await targetDb.query(query, params);
  }

  async getMetricsPoints(
    metricId: string,
    fromDate: string,
    toDate: string
  ): Promise<MetricsPoint[]> {
    const query = `
      SELECT metric_id, ts, value, metadata
      FROM metrics_points 
      WHERE metric_id = $1 
        AND ts >= $2 
        AND ts <= $3 
      ORDER BY ts
    `;

    const result = await targetDb.query(query, [metricId, fromDate, toDate]);
    return result.rows as MetricsPoint[];
  }

  async getLastMetricTimestamp(metricId: string): Promise<string | null> {
    const query = `
      SELECT MAX(ts) as last_ts
      FROM metrics.metrics_points 
      WHERE metric_id = $1
    `;

    const result = await targetDb.query(query, [metricId]);
    const row = result.rows[0] as { last_ts: string } | null;
    return row?.last_ts || null;
  }
}
