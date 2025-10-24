import { sourceDb } from '@/infrastructure/db/sourcePool.js';
import type { SeriesPoint } from '@/domain/entities/series.js';

export interface SourceSeriesRepository {
  getSeriesPoints(seriesId: string, fromDate: string, toDate: string): Promise<SeriesPoint[]>;
  getSeriesMetadata(seriesId: string): Promise<{
    id: string;
    source: string;
    frequency: string;
    unit?: string;
    metadata?: Record<string, unknown>;
  } | null>;
}

export class SourceSeriesRepositoryImpl implements SourceSeriesRepository {
  async getSeriesPoints(
    seriesId: string,
    fromDate: string,
    toDate: string
  ): Promise<SeriesPoint[]> {
    const query = `
      SELECT ts, value
      FROM public.series_points 
      WHERE series_id = $1 
        AND ts >= $2 
        AND ts <= $3 
      ORDER BY ts
    `;

    const result = await sourceDb.query(query, [seriesId, fromDate, toDate]);
    return result.rows as SeriesPoint[];
  }

  async getSeriesMetadata(seriesId: string): Promise<{
    id: string;
    source: string;
    frequency: string;
    unit?: string;
    metadata?: Record<string, unknown>;
  } | null> {
    const query = `
      SELECT id, source, frequency, unit, metadata
      FROM public.series 
      WHERE id = $1
    `;

    const result = await sourceDb.query(query, [seriesId]);
    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as {
      id: string;
      source: string;
      frequency: string;
      unit?: string;
      metadata?: Record<string, unknown>;
    };
  }
}
