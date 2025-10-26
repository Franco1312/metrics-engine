import { MetricsRepository } from '@/infrastructure/db/metricsRepo.js';
import { MetricsDefinitionsRepository, MetricDefinition } from '@/infrastructure/db/metricsDefinitionsRepo.js';
import { logger } from '@/infrastructure/log/logger.js';
import { SERVER } from '@/infrastructure/log/log-events.js';

export interface GetPointsRequest {
  metricId: string;
  from?: string | undefined;
  to?: string | undefined;
  limit?: number;
}

export interface GetLatestRequest {
  metricIds: string[];
}

export interface MetricInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  unit: string;
  formula?: string | undefined;
  dependencies: string[];
}

export interface GetMetricsListRequest {
  id?: string | undefined;
}

export class MetricsService {
  constructor(
    private metricsRepository: MetricsRepository,
    private definitionsRepository: MetricsDefinitionsRepository
  ) {}

  async getPoints(request: GetPointsRequest) {
    logger.info({
      event: SERVER.INIT,
      msg: 'Getting metric points',
      data: { metricId: request.metricId },
    });

    try {
      const exists = await this.metricsRepository.metricExists(request.metricId);
      if (!exists) {
        throw new Error(`Metric ${request.metricId} not found`);
      }

      const points = await this.metricsRepository.getMetricPoints(
        request.metricId,
        request.from,
        request.to,
        request.limit || 500
      );

      logger.info({
        event: SERVER.FINISHED,
        msg: 'Metric points retrieved successfully',
        data: {
          metricId: request.metricId,
          count: points.length,
        },
      });

      return points;
    } catch (error) {
      logger.error({
        event: SERVER.ERROR,
        msg: 'Failed to get metric points',
        err: error as Error,
        data: { metricId: request.metricId },
      });
      throw error;
    }
  }

  async getLatest(request: GetLatestRequest) {
    logger.info({
      event: SERVER.INIT,
      msg: 'Getting latest metrics',
      data: { metricIds: request.metricIds },
    });

    try {
      const result = await this.metricsRepository.getLatestMetrics(request.metricIds);
      const metricsDefinitions = await this.definitionsRepository.getAllDefinitions();
      const metricsMap = new Map(metricsDefinitions.map(m => [m.id, m]));

      // Enriquecer los resultados con metadatos de las métricas
      const enrichedItems = result.items.map(item => {
        const definition = metricsMap.get(item.metric_id);
        return {
          ...item,
          metadata: {
            ...item.metadata,
            category: definition?.category || 'unknown',
            name: definition?.name || item.metric_id,
            description: definition?.description || '',
            unit: definition?.unit || 'unknown',
            formula: definition?.formula || '',
            dependencies: definition?.dependencies || [],
          },
        };
      });

      // Agrupar por categoría
      const groupedByCategory = enrichedItems.reduce(
        (acc, item) => {
          const category = item.metadata.category;
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(item);
          return acc;
        },
        {} as Record<string, typeof enrichedItems>
      );

      // Enriquecer métricas faltantes con información
      const enrichedMissing = result.missing.map(metricId => {
        const definition = metricsMap.get(metricId);
        return {
          metric_id: metricId,
          category: definition?.category || 'unknown',
          name: definition?.name || metricId,
          description: definition?.description || '',
          unit: definition?.unit || 'unknown',
          reason: 'not_found',
        };
      });

      const enrichedResult = {
        items: enrichedItems,
        missing: enrichedMissing,
        summary: {
          total_requested: request.metricIds.length,
          found: enrichedItems.length,
          missing: enrichedMissing.length,
          by_category: Object.keys(groupedByCategory).map(category => ({
            category,
            count: groupedByCategory[category]?.length || 0,
            metrics:
              groupedByCategory[category]?.map(item => ({
                id: item.metric_id,
                name: item.metadata.name,
                value: item.value,
                ts: item.ts,
                unit: item.metadata.unit,
              })) || [],
          })),
        },
      };

      logger.info({
        event: SERVER.FINISHED,
        msg: 'Latest metrics retrieved successfully',
        data: {
          requested: request.metricIds.length,
          found: enrichedItems.length,
          missing: enrichedMissing.length,
          categories: Object.keys(groupedByCategory),
        },
      });

      return enrichedResult;
    } catch (error) {
      logger.error({
        event: SERVER.ERROR,
        msg: 'Failed to get latest metrics',
        err: error as Error,
        data: { metricIds: request.metricIds },
      });
      throw error;
    }
  }

  async getMetricsList(request: GetMetricsListRequest): Promise<MetricInfo[]> {
    logger.info({
      event: SERVER.INIT,
      msg: 'Getting metrics list',
      data: { id: request.id },
    });

    try {
      const definitions = await this.fetchDefinitions(request.id);
      const metrics = this.mapToMetricInfo(definitions);

      logger.info({
        event: SERVER.FINISHED,
        msg: 'Metrics list retrieved successfully',
        data: { count: metrics.length, id: request.id },
      });

      return metrics;
    } catch (error) {
      logger.error({
        event: SERVER.ERROR,
        msg: 'Failed to get metrics list',
        err: error as Error,
        data: { id: request.id },
      });
      throw error;
    }
  }

  private async fetchDefinitions(id?: string): Promise<MetricDefinition[]> {
    const definition = id 
      ? await this.definitionsRepository.getDefinitionById(id)
      : null;
    
    return definition ? [definition] : await this.definitionsRepository.getAllDefinitions();
  }

  private mapToMetricInfo(definitions: MetricDefinition[]): MetricInfo[] {
    return definitions.map(def => ({
      id: def.id,
      name: def.name,
      category: def.category,
      description: def.description,
      unit: def.unit,
      formula: def.formula,
      dependencies: def.dependencies,
    }));
  }
}
