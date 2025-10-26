import type { SeriesPoint } from '@/domain/entities/series.js';
import type { TargetMetricsRepository } from '@/infrastructure/db/metricsRepo.target.js';
import { logger } from '@/infrastructure/log/logger.js';
import { METRICS_COMPUTATION } from '@/infrastructure/log/log-events.js';
import { BusinessDaysService, SeriesUtils } from '@/domain/utils/index.js';

export interface DeltaBaseInputs {
  base: SeriesPoint[];
}

export interface DeltaBaseResult {
  metricId: string;
  ts: string;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * Use case para calcular deltas de base monetaria
 * Calcula variaciones absolutas y porcentuales en ventanas de 7, 30 y 90 días hábiles
 */
export class DeltaBaseUseCase {
  private static readonly DELTA_WINDOWS = [7, 30, 90] as const;
  private static readonly BASE_SERIES_ID = '15';

  constructor(private targetRepo: TargetMetricsRepository) {}

  /**
   * Ejecuta el cálculo de deltas de base monetaria
   */
  async execute(inputs: DeltaBaseInputs): Promise<DeltaBaseResult[]> {
    logger.info({
      event: METRICS_COMPUTATION.INIT,
      msg: 'Computing base monetary deltas',
    });

    const sortedBase = this.prepareBaseData(inputs.base);
    const results = this.calculateAllDeltas(sortedBase);

    if (results.length > 0) {
      await this.persistResults(results);
      this.logSuccess(results.length);
    }

    return results;
  }

  /**
   * Prepara los datos de base monetaria ordenándolos por fecha
   */
  private prepareBaseData(base: SeriesPoint[]): SeriesPoint[] {
    return SeriesUtils.sortByDate(base);
  }

  /**
   * Calcula todos los deltas para todas las ventanas de tiempo
   */
  private calculateAllDeltas(sortedBase: SeriesPoint[]): DeltaBaseResult[] {
    const results: DeltaBaseResult[] = [];

    for (const window of DeltaBaseUseCase.DELTA_WINDOWS) {
      const windowResults = this.calculateDeltasForWindow(sortedBase, window);
      results.push(...windowResults);
    }

    return results;
  }

  /**
   * Calcula deltas para una ventana específica de días hábiles
   */
  private calculateDeltasForWindow(
    sortedBase: SeriesPoint[],
    windowDays: number
  ): DeltaBaseResult[] {
    const results: DeltaBaseResult[] = [];

    for (let i = 0; i < sortedBase.length; i++) {
      const currentPoint = sortedBase[i]!;
      const referencePoint = this.findReferencePoint(sortedBase, currentPoint, windowDays);

      if (this.canCalculateDelta(referencePoint)) {
        const deltas = this.computeAbsoluteAndPercentageDeltas(
          currentPoint,
          referencePoint!,
          windowDays
        );
        results.push(...deltas);
      }
    }

    return results;
  }

  /**
   * Encuentra el punto de referencia n días hábiles hacia atrás
   */
  private findReferencePoint(
    sortedBase: SeriesPoint[],
    currentPoint: SeriesPoint,
    windowDays: number
  ): { point: SeriesPoint; dateStr: string } | null {
    const currentDate = this.parseDate(currentPoint.ts);
    const referenceDate = BusinessDaysService.subtractBusinessDays(currentDate, windowDays);
    const referenceDateStr = referenceDate.toISOString().split('T')[0] as string;

    const referenceValue = SeriesUtils.getValueAtDate(sortedBase, referenceDateStr);

    if (referenceValue === null) {
      return null;
    }

    // Encontrar el punto completo de referencia
    const referencePoint = sortedBase.find(point => {
      const pointDateStr =
        typeof point.ts === 'string'
          ? point.ts.split('T')[0]
          : new Date(point.ts).toISOString().split('T')[0];
      return pointDateStr === referenceDateStr;
    });

    return referencePoint ? { point: referencePoint, dateStr: referenceDateStr } : null;
  }

  /**
   * Verifica si se puede calcular el delta (referencia válida y no cero)
   */
  private canCalculateDelta(reference: { point: SeriesPoint; dateStr: string } | null): boolean {
    return reference !== null && reference.point.value !== 0;
  }

  /**
   * Calcula deltas absoluto y porcentual para un punto
   */
  private computeAbsoluteAndPercentageDeltas(
    currentPoint: SeriesPoint,
    reference: { point: SeriesPoint; dateStr: string },
    windowDays: number
  ): DeltaBaseResult[] {
    const results: DeltaBaseResult[] = [];

    // Normalizar valores a millones de ARS
    const currentMillions = this.normalizeToMillions(currentPoint.value);
    const referenceMillions = this.normalizeToMillions(reference.point.value);

    // Delta absoluto (en millones de ARS)
    const absoluteDelta = currentMillions - referenceMillions;
    results.push(
      this.createDeltaResult(
        `delta.base_${windowDays}d.abs`,
        currentPoint.ts,
        absoluteDelta,
        'abs',
        currentMillions,
        referenceMillions,
        reference.dateStr,
        'million_ARS'
      )
    );

    // Delta porcentual
    const percentageDelta = (currentPoint.value / reference.point.value - 1) * 100;
    results.push(
      this.createDeltaResult(
        `delta.base_${windowDays}d.pct`,
        currentPoint.ts,
        percentageDelta,
        'pct',
        currentMillions,
        referenceMillions,
        reference.dateStr,
        'percent'
      )
    );

    return results;
  }

  /**
   * Normaliza un valor a millones de ARS
   * Si el valor es muy grande (>1M), asume que ya está en ARS y divide por 1M
   * Si el valor es pequeño (<1M), asume que ya está en millones
   */
  private normalizeToMillions(value: number): number {
    if (value > 1_000_000) {
      // Valor grande, asumir que está en ARS y convertir a millones
      return value / 1_000_000;
    }
    // Valor pequeño, asumir que ya está en millones
    return value;
  }

  /**
   * Crea un resultado de delta con metadata completo
   */
  private createDeltaResult(
    metricId: string,
    ts: string,
    value: number,
    mode: 'abs' | 'pct',
    currentValue: number,
    referenceValue: number,
    referenceDate: string,
    units: string
  ): DeltaBaseResult {
    return {
      metricId,
      ts,
      value,
      metadata: {
        depends_on: [DeltaBaseUseCase.BASE_SERIES_ID],
        window: metricId.split('_')[1], // Extrae "7d", "30d", "90d"
        mode,
        current: currentValue,
        reference: referenceValue,
        reference_date: referenceDate,
        units,
        scale: mode === 'abs' ? 'million' : undefined,
      },
    };
  }

  /**
   * Parsea una fecha desde string o Date
   */
  private parseDate(ts: string): Date {
    return typeof ts === 'string' ? new Date(ts) : new Date(ts);
  }

  /**
   * Persiste los resultados en la base de datos
   */
  private async persistResults(results: DeltaBaseResult[]): Promise<void> {
    const metricsPoints = results.map(result => ({
      metric_id: result.metricId,
      ts: result.ts,
      value: result.value,
      metadata: result.metadata || {},
    }));

    await this.targetRepo.upsertMetricsPoints(metricsPoints);
  }

  /**
   * Registra el éxito de la operación
   */
  private logSuccess(count: number): void {
    logger.info({
      event: METRICS_COMPUTATION.FINISHED,
      msg: 'Base monetary deltas computed successfully',
      data: { count },
    });
  }
}
