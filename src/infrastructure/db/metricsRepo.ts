import { targetDb } from '@/infrastructure/db/targetPool.js';
import { logger } from '@/infrastructure/log/logger.js';
import { DATABASE } from '@/infrastructure/log/log-events.js';

export interface MetricPoint {
  metric_id: string;
  ts: string;
  value: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MetricSummary {
  metric_id: string;
  ts: string;
  value: number;
  metadata?: Record<string, unknown>;
}

export class MetricsRepository {
  async getMetricPoints(
    metricId: string,
    from?: string,
    to?: string,
    limit: number = 500
  ): Promise<MetricPoint[]> {
    logger.info({
      event: DATABASE.QUERY,
      msg: 'Fetching metric points',
      data: { metricId, from, to, limit },
    });

    let whereConditions = ['metric_id = $1'];
    let queryParams: unknown[] = [metricId];
    let paramIndex = 2;

    if (from) {
      whereConditions.push(`ts >= $${paramIndex}`);
      queryParams.push(from);
      paramIndex++;
    }

    if (to) {
      whereConditions.push(`ts <= $${paramIndex}`);
      queryParams.push(to);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');
    const limitClause = `LIMIT ${Math.min(limit, 5000)}`;

    const query = `
      SELECT metric_id, ts, value, metadata, created_at, updated_at
      FROM metrics.metrics_points
      WHERE ${whereClause}
      ORDER BY ts DESC
      ${limitClause}
    `;

    const result = await targetDb.query(query, queryParams);
    return result.rows as MetricPoint[];
  }

  async getLatestMetrics(metricIds: string[]): Promise<{
    items: MetricSummary[];
    missing: string[];
  }> {
    logger.info({
      event: DATABASE.QUERY,
      msg: 'Fetching latest metrics',
      data: { metricIds },
    });

    if (metricIds.length === 0) {
      return { items: [], missing: [] };
    }

    const placeholders = metricIds.map((_, index) => `$${index + 1}`).join(',');
    const query = `
      SELECT DISTINCT ON (metric_id) metric_id, ts, value, metadata
      FROM metrics.metrics_points
      WHERE metric_id IN (${placeholders})
      ORDER BY metric_id, ts DESC
    `;

    const result = await targetDb.query(query, metricIds);
    const items = result.rows as MetricSummary[];

    const foundIds = new Set(items.map(item => item.metric_id));
    const missing = metricIds.filter(id => !foundIds.has(id));

    return { items, missing };
  }

  async metricExists(metricId: string): Promise<boolean> {
    const query = 'SELECT 1 FROM metrics.metrics WHERE id = $1 LIMIT 1';
    const result = await targetDb.query(query, [metricId]);
    return result.rows.length > 0;
  }
}
