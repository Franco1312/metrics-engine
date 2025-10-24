export interface Series {
  id: string;
  source: string;
  frequency: string;
  unit?: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface SeriesPoint {
  series_id: string;
  ts: string;
  value: number;
  created_at: Date;
  updated_at: Date;
}

export interface MetricsPoint {
  metric_id: string;
  ts: string;
  value: number;
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}
