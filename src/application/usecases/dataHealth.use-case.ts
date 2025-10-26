import type { SeriesPoint } from '@/domain/entities/series.js';
import type { TargetMetricsRepository } from '@/infrastructure/db/metricsRepo.target.js';
import { logger } from '@/infrastructure/log/logger.js';
import { METRICS_COMPUTATION } from '@/infrastructure/log/log-events.js';
import { DateService, BusinessDaysService } from '@/domain/utils/index.js';

export interface DataHealthInputs {
  series: Array<{
    seriesId: string;
    points: SeriesPoint[];
  }>;
}

export interface DataHealthResult {
  metricId: string;
  ts: string;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * Use case para calcular métricas de calidad de datos
 * Calcula freshness, coverage y gaps para cada serie
 */
export class DataHealthUseCase {
  private static readonly FRESHNESS_THRESHOLD_HOURS = 24;
  private static readonly COVERAGE_THRESHOLD_BUSINESS_DAYS = 90; // Cambiar a 90 días hábiles

  constructor(private targetRepo: TargetMetricsRepository) {}

  /**
   * Ejecuta el cálculo de métricas de calidad de datos
   */
  async execute(inputs: DataHealthInputs): Promise<DataHealthResult[]> {
    logger.info({
      event: METRICS_COMPUTATION.INIT,
      msg: 'Computing data health metrics',
    });

    const results: DataHealthResult[] = [];

    for (const seriesData of inputs.series) {
      if (this.hasValidSeriesData(seriesData)) {
        this.calculateHealthMetricsForSeries(seriesData, results);
      } else {
        this.logInvalidSeriesData(seriesData.seriesId);
      }
    }

    if (results.length > 0) {
      await this.persistResults(results);
      this.logSuccess(results.length);
    }

    return results;
  }

  /**
   * Verifica si la serie tiene datos válidos
   */
  private hasValidSeriesData(seriesData: { seriesId: string; points: SeriesPoint[] }): boolean {
    return seriesData.points.length > 0;
  }

  /**
   * Registra cuando una serie no tiene datos válidos
   */
  private logInvalidSeriesData(seriesId: string): void {
    logger.info({
      event: METRICS_COMPUTATION.METRIC_SKIPPED,
      msg: 'Skipping data health calculation for series with no data',
      data: { seriesId },
    });
  }

  /**
   * Calcula las métricas de salud para una serie específica
   */
  private calculateHealthMetricsForSeries(
    seriesData: { seriesId: string; points: SeriesPoint[] },
    results: DataHealthResult[]
  ): void {
    const sortedPoints = this.sortSeriesByDate(seriesData.points);
    const today = new Date();

    // Calcular freshness
    this.calculateFreshnessMetric(seriesData.seriesId, sortedPoints, today, results);

    // Calcular coverage
    this.calculateCoverageMetric(seriesData.seriesId, sortedPoints, today, results);

    // Calcular gaps
    this.calculateGapsMetric(seriesData.seriesId, sortedPoints, results);
  }

  /**
   * Ordena los puntos de la serie por fecha
   */
  private sortSeriesByDate(points: SeriesPoint[]): SeriesPoint[] {
    return [...points].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  }

  /**
   * Calcula la métrica de freshness
   */
  private calculateFreshnessMetric(
    seriesId: string,
    sortedPoints: SeriesPoint[],
    today: Date,
    results: DataHealthResult[]
  ): void {
    const lastPoint = sortedPoints[sortedPoints.length - 1];
    if (!lastPoint) return;

    const lastPointDate = this.parseDate(lastPoint.ts);
    const hoursSinceLastUpdate = this.calculateHoursDifference(today, lastPointDate);
    const isFresh = hoursSinceLastUpdate <= DataHealthUseCase.FRESHNESS_THRESHOLD_HOURS;

    results.push(this.createFreshnessResult(seriesId, lastPoint.ts, isFresh, hoursSinceLastUpdate));
  }

  /**
   * Calcula la métrica de coverage usando business days
   */
  private calculateCoverageMetric(
    seriesId: string,
    sortedPoints: SeriesPoint[],
    today: Date,
    results: DataHealthResult[]
  ): void {
    const ninetyBusinessDaysAgo = BusinessDaysService.subtractBusinessDays(
      today,
      DataHealthUseCase.COVERAGE_THRESHOLD_BUSINESS_DAYS
    );
    const coveragePeriod = this.filterPointsInPeriod(sortedPoints, ninetyBusinessDaysAgo, today);

    // Calcular días hábiles en el período
    const expectedBusinessDays = DataHealthUseCase.COVERAGE_THRESHOLD_BUSINESS_DAYS;
    const actualBusinessDays = this.countBusinessDaysInPeriod(
      coveragePeriod,
      ninetyBusinessDaysAgo,
      today
    );
    const coverageRatio = actualBusinessDays / expectedBusinessDays;

    results.push(
      this.createCoverageResult(
        seriesId,
        DateService.formatDate(today),
        coverageRatio,
        actualBusinessDays,
        expectedBusinessDays
      )
    );
  }

  /**
   * Cuenta los días hábiles en un período que tienen datos
   */
  private countBusinessDaysInPeriod(points: SeriesPoint[], startDate: Date, endDate: Date): number {
    let businessDaysWithData = 0;
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      if (BusinessDaysService.isBusinessDay(currentDate)) {
        const dateStr = DateService.formatDate(currentDate);
        const hasData = points.some(point => {
          const pointDateStr =
            typeof point.ts === 'string'
              ? point.ts.split('T')[0]
              : DateService.formatDate(new Date(point.ts));
          return pointDateStr === dateStr;
        });

        if (hasData) {
          businessDaysWithData++;
        }
      }
      currentDate = DateService.addDays(currentDate, 1);
    }

    return businessDaysWithData;
  }

  /**
   * Calcula la métrica de gaps
   */
  private calculateGapsMetric(
    seriesId: string,
    sortedPoints: SeriesPoint[],
    results: DataHealthResult[]
  ): void {
    if (sortedPoints.length < 2) return;

    const gaps = this.identifyGapsInSeries(sortedPoints);
    const totalGaps = gaps.length;
    const maxGapDays = this.calculateMaxGapDays(gaps);

    results.push(
      this.createGapsResult(
        seriesId,
        sortedPoints[sortedPoints.length - 1]!.ts,
        totalGaps,
        maxGapDays
      )
    );
  }

  /**
   * Filtra los puntos que están dentro de un período específico
   */
  private filterPointsInPeriod(
    points: SeriesPoint[],
    startDate: Date,
    endDate: Date
  ): SeriesPoint[] {
    return points.filter(point => {
      const pointDate = this.parseDate(point.ts);
      return pointDate >= startDate && pointDate <= endDate;
    });
  }

  /**
   * Identifica los gaps en la serie
   */
  private identifyGapsInSeries(
    sortedPoints: SeriesPoint[]
  ): Array<{ start: Date; end: Date; days: number }> {
    const gaps: Array<{ start: Date; end: Date; days: number }> = [];

    for (let i = 1; i < sortedPoints.length; i++) {
      const currentDate = this.parseDate(sortedPoints[i]!.ts);
      const previousDate = this.parseDate(sortedPoints[i - 1]!.ts);
      const daysDifference = this.calculateDaysDifference(currentDate, previousDate);

      if (daysDifference > 1) {
        gaps.push({
          start: previousDate,
          end: currentDate,
          days: daysDifference - 1,
        });
      }
    }

    return gaps;
  }

  /**
   * Calcula el máximo número de días de gap
   */
  private calculateMaxGapDays(gaps: Array<{ days: number }>): number {
    if (gaps.length === 0) return 0;
    return Math.max(...gaps.map(gap => gap.days));
  }

  /**
   * Calcula la diferencia en horas entre dos fechas
   */
  private calculateHoursDifference(date1: Date, date2: Date): number {
    return Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60);
  }

  /**
   * Calcula la diferencia en días entre dos fechas
   */
  private calculateDaysDifference(date1: Date, date2: Date): number {
    return Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
  }

  /**
   * Parsea una fecha desde string o Date
   */
  private parseDate(ts: string): Date {
    return typeof ts === 'string' ? new Date(ts) : new Date(ts);
  }

  /**
   * Crea el resultado para la métrica de freshness
   */
  private createFreshnessResult(
    seriesId: string,
    ts: string,
    isFresh: boolean,
    hoursSinceLastUpdate: number
  ): DataHealthResult {
    return {
      metricId: `data.freshness.${seriesId}`,
      ts,
      value: hoursSinceLastUpdate, // Cambiar a horas numéricas
      metadata: {
        depends_on: [seriesId],
        is_fresh: isFresh,
        threshold_hours: DataHealthUseCase.FRESHNESS_THRESHOLD_HOURS,
        hours_since_last_update: hoursSinceLastUpdate,
        units: 'hours',
      },
    };
  }

  /**
   * Crea el resultado para la métrica de coverage
   */
  private createCoverageResult(
    seriesId: string,
    ts: string,
    coverageRatio: number,
    actualDays: number,
    expectedDays: number
  ): DataHealthResult {
    return {
      metricId: `data.coverage.${seriesId}`,
      ts,
      value: coverageRatio,
      metadata: {
        depends_on: [seriesId],
        basis: 'business_days',
        window: '90bd',
        actual_days: actualDays,
        expected_days: expectedDays,
        units: 'ratio',
      },
    };
  }

  /**
   * Crea el resultado para la métrica de gaps
   */
  private createGapsResult(
    seriesId: string,
    ts: string,
    totalGaps: number,
    maxGapDays: number
  ): DataHealthResult {
    return {
      metricId: `data.gaps.${seriesId}`,
      ts,
      value: totalGaps,
      metadata: {
        depends_on: [seriesId],
        total_gaps: totalGaps,
        max_gap_days: maxGapDays,
        units: 'count',
      },
    };
  }

  /**
   * Persiste los resultados en la base de datos
   */
  private async persistResults(results: DataHealthResult[]): Promise<void> {
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
      msg: 'Data health metrics computed successfully',
      data: { count },
    });
  }
}
