import type { SeriesPoint } from '@/domain/entities/series.js';
import type { TargetMetricsRepository } from '@/infrastructure/db/metricsRepo.target.js';
import { logger } from '@/infrastructure/log/logger.js';
import { METRICS_COMPUTATION } from '@/infrastructure/log/log-events.js';
import { BusinessDaysService, SeriesUtils } from '@/domain/utils/index.js';

export interface DeltaReservesInputs {
  reserves: SeriesPoint[];
}

export interface DeltaReservesResult {
  metricId: string;
  ts: string;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * Use case para calcular deltas de reservas internacionales
 * Calcula variaciones absolutas y porcentuales en ventanas de 7 y 30 días hábiles
 */
export class DeltaReservesUseCase {
  private static readonly DELTA_WINDOWS = [7, 30] as const;
  private static readonly RESERVES_SERIES_ID = '1';

  constructor(private targetRepo: TargetMetricsRepository) {}

  /**
   * Ejecuta el cálculo de deltas de reservas internacionales
   */
  async execute(inputs: DeltaReservesInputs): Promise<DeltaReservesResult[]> {
    logger.info({
      event: METRICS_COMPUTATION.INIT,
      msg: 'Computing reserves monetary deltas',
    });

    const sortedReserves = this.prepareReservesData(inputs.reserves);
    const results = this.calculateAllDeltas(sortedReserves);

    if (results.length > 0) {
      await this.persistResults(results);
      this.logSuccess(results.length);
    }

    return results;
  }

  /**
   * Prepara los datos de reservas ordenándolos por fecha
   */
  private prepareReservesData(reserves: SeriesPoint[]): SeriesPoint[] {
    return SeriesUtils.sortByDate(reserves);
  }

  /**
   * Calcula todos los deltas para todas las ventanas de tiempo
   */
  private calculateAllDeltas(sortedReserves: SeriesPoint[]): DeltaReservesResult[] {
    const results: DeltaReservesResult[] = [];

    for (const window of DeltaReservesUseCase.DELTA_WINDOWS) {
      const windowResults = this.calculateDeltasForWindow(sortedReserves, window);
      results.push(...windowResults);
    }

    return results;
  }

  /**
   * Calcula deltas para una ventana específica de días hábiles
   */
  private calculateDeltasForWindow(
    sortedReserves: SeriesPoint[],
    windowDays: number
  ): DeltaReservesResult[] {
    const results: DeltaReservesResult[] = [];

    for (let i = 0; i < sortedReserves.length; i++) {
      const currentPoint = sortedReserves[i]!;
      const referencePoint = this.findReferencePoint(sortedReserves, currentPoint, windowDays);

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
    sortedReserves: SeriesPoint[],
    currentPoint: SeriesPoint,
    windowDays: number
  ): { point: SeriesPoint; dateStr: string } | null {
    const currentDate = this.parseDate(currentPoint.ts);
    const referenceDate = BusinessDaysService.subtractBusinessDays(currentDate, windowDays);
    const referenceDateStr = referenceDate.toISOString().split('T')[0] as string;

    const referenceValue = SeriesUtils.getValueAtDate(sortedReserves, referenceDateStr);

    if (referenceValue === null) {
      return null;
    }

    // Encontrar el punto completo de referencia
    const referencePoint = sortedReserves.find(point => {
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
  ): DeltaReservesResult[] {
    const results: DeltaReservesResult[] = [];

    // Normalizar valores a millones de USD
    const currentMillions = this.normalizeToMillions(currentPoint.value);
    const referenceMillions = this.normalizeToMillions(reference.point.value);

    // Delta absoluto (en millones de USD)
    const absoluteDelta = currentMillions - referenceMillions;
    results.push(
      this.createDeltaResult(
        `delta.reserves_${windowDays}d.abs`,
        currentPoint.ts,
        absoluteDelta,
        'abs',
        currentMillions,
        referenceMillions,
        reference.dateStr,
        'million_USD'
      )
    );

    // Delta porcentual
    const percentageDelta = (currentPoint.value / reference.point.value - 1) * 100;
    results.push(
      this.createDeltaResult(
        `delta.reserves_${windowDays}d.pct`,
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
   * Normaliza un valor a millones de USD
   * Si el valor es muy grande (>1M), asume que ya está en USD y divide por 1M
   * Si el valor es pequeño (<1M), asume que ya está en millones
   */
  private normalizeToMillions(value: number): number {
    if (value > 1_000_000) {
      // Valor grande, asumir que está en USD y convertir a millones
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
  ): DeltaReservesResult {
    return {
      metricId,
      ts,
      value,
      metadata: {
        depends_on: [DeltaReservesUseCase.RESERVES_SERIES_ID],
        window: metricId.split('_')[1], // Extrae "7d", "30d"
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
  private async persistResults(results: DeltaReservesResult[]): Promise<void> {
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
      msg: 'Reserves monetary deltas computed successfully',
      data: { count },
    });
  }
}
