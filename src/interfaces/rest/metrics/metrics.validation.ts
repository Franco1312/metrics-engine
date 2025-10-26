import { z } from 'zod';

export const GetMetricPointsSchema = z.object({
  metricId: z.string().min(1, 'Metric ID is required'),
  from: z
    .string()
    .optional()
    .refine(
      val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val),
      'From date must be in YYYY-MM-DD format'
    ),
  to: z
    .string()
    .optional()
    .refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), 'To date must be in YYYY-MM-DD format'),
  limit: z.coerce.number().int().min(1).max(5000).optional().default(500),
});

export const GetLatestMetricsSchema = z.object({
  ids: z.string().min(1, 'ids parameter is required'),
});

export const GetMetricsListSchema = z.object({
  id: z.string().optional(),
});

export type GetMetricPointsRequest = z.infer<typeof GetMetricPointsSchema>;
export type GetLatestMetricsRequest = z.infer<typeof GetLatestMetricsSchema>;
export type GetMetricsListRequest = z.infer<typeof GetMetricsListSchema>;
