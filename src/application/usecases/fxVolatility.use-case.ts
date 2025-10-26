import type { SeriesPoint } from '@/domain/entities/series.js';
import type { TargetMetricsRepository } from '@/infrastructure/db/metricsRepo.target.js';
import { logger } from '@/infrastructure/log/logger.js';
import { METRICS_COMPUTATION } from '@/infrastructure/log/log-events.js';
import { SeriesUtils, StatisticsService } from '@/domain/utils/index.js';

export interface FxVolatilityInputs {
  usdOfficial: SeriesPoint[];
}

export interface FxVolatilityResult {
  metricId: string;
  ts: string;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * Use case para calcular volatilidad y tendencia del USD oficial
 * Calcula volatilidad (desviación estándar de retornos logarítmicos) y tendencia (diferencia de medias móviles)
 */
export class FxVolatilityUseCase {
  private static readonly USD_SERIES_ID = 'bcra.cambiarias.usd';
  private static readonly VOLATILITY_WINDOWS = [7, 30] as const;
  private static readonly TREND_MA_SHORT = 14;
  private static readonly TREND_MA_LONG = 30;

  constructor(private targetRepo: TargetMetricsRepository) {}

  /**
   * Ejecuta el cálculo de métricas de volatilidad y tendencia FX
   */
  async execute(inputs: FxVolatilityInputs): Promise<FxVolatilityResult[]> {
    logger.info({
      event: METRICS_COMPUTATION.INIT,
      msg: 'Computing FX volatility and trend metrics',
    });

    const results: FxVolatilityResult[] = [];

    if (!this.validateInputData(inputs)) {
      return results;
    }

    const preparedData = this.prepareVolatilityData(inputs);
    this.calculateVolatilityMetrics(preparedData, results);
    this.calculateTrendMetrics(preparedData, results);

    if (results.length > 0) {
      await this.persistResults(results);
      this.logSuccess(results.length);
    }

    return results;
  }

  /**
   * Valida que tenemos suficientes datos para los cálculos
   */
  private validateInputData(inputs: FxVolatilityInputs): boolean {
    if (inputs.usdOfficial.length < FxVolatilityUseCase.TREND_MA_LONG) {
      logger.info({
        event: METRICS_COMPUTATION.METRIC_SKIPPED,
        msg: 'Insufficient USD official data for FX volatility calculation',
        data: {
          dataPoints: inputs.usdOfficial.length,
          required: FxVolatilityUseCase.TREND_MA_LONG,
        },
      });
      return false;
    }
    return true;
  }

  /**
   * Prepara los datos ordenándolos y calculando retornos logarítmicos
   */
  private prepareVolatilityData(inputs: FxVolatilityInputs): {
    sortedUsd: SeriesPoint[];
    logReturns: { ts: string; value: number }[];
    prices: number[];
  } {
    const sortedUsd = SeriesUtils.sortByDate(inputs.usdOfficial);
    const logReturns = SeriesUtils.calculateLogReturns(sortedUsd);
    const prices = sortedUsd.map(p => p.value);

    return { sortedUsd, logReturns, prices };
  }

  /**
   * Calcula las métricas de volatilidad para todas las ventanas
   */
  private calculateVolatilityMetrics(
    data: { logReturns: { ts: string; value: number }[]; sortedUsd: SeriesPoint[] },
    results: FxVolatilityResult[]
  ): void {
    if (data.logReturns.length < FxVolatilityUseCase.VOLATILITY_WINDOWS[1]) {
      logger.info({
        event: METRICS_COMPUTATION.METRIC_SKIPPED,
        msg: 'Insufficient log returns for volatility calculation',
        data: {
          logReturns: data.logReturns.length,
          required: FxVolatilityUseCase.VOLATILITY_WINDOWS[1],
        },
      });
      return;
    }

    for (const window of FxVolatilityUseCase.VOLATILITY_WINDOWS) {
      this.calculateVolatilityForWindow(data, window, results);
    }
  }

  /**
   * Calcula la volatilidad para una ventana específica
   */
  private calculateVolatilityForWindow(
    data: { logReturns: { ts: string; value: number }[]; sortedUsd: SeriesPoint[] },
    window: number,
    results: FxVolatilityResult[]
  ): void {
    for (let i = window - 1; i < data.logReturns.length; i++) {
      const windowReturns = this.extractWindowReturns(data.logReturns, i, window);
      const volatility = StatisticsService.stdev(windowReturns);
      const ts = this.getTimestampForVolatility(data.sortedUsd, i);

      results.push(this.createVolatilityResult(ts, window, volatility));
    }
  }

  /**
   * Extrae los retornos de una ventana específica
   */
  private extractWindowReturns(
    logReturns: { ts: string; value: number }[],
    endIndex: number,
    window: number
  ): number[] {
    return logReturns.slice(endIndex - window + 1, endIndex + 1).map(lr => lr.value);
  }

  /**
   * Obtiene el timestamp correspondiente para la volatilidad
   */
  private getTimestampForVolatility(sortedUsd: SeriesPoint[], logReturnIndex: number): string {
    // El índice de logReturns es uno menos que el de precios
    const priceIndex = logReturnIndex + 1;
    return sortedUsd[priceIndex]!.ts;
  }

  /**
   * Crea el resultado para una métrica de volatilidad
   */
  private createVolatilityResult(
    ts: string,
    window: number,
    volatility: number
  ): FxVolatilityResult {
    return {
      metricId: `fx.vol_${window}d.usd`,
      ts,
      value: volatility,
      metadata: {
        depends_on: [FxVolatilityUseCase.USD_SERIES_ID],
        window: `${window}d`,
        return: 'log',
        volatility_type: 'standard_deviation',
        units: 'ratio',
      },
    };
  }

  /**
   * Calcula las métricas de tendencia usando medias móviles
   */
  private calculateTrendMetrics(
    data: { prices: number[]; sortedUsd: SeriesPoint[] },
    results: FxVolatilityResult[]
  ): void {
    if (data.prices.length < FxVolatilityUseCase.TREND_MA_LONG) {
      logger.info({
        event: METRICS_COMPUTATION.METRIC_SKIPPED,
        msg: 'Insufficient price data for trend calculation',
        data: { prices: data.prices.length, required: FxVolatilityUseCase.TREND_MA_LONG },
      });
      return;
    }

    const movingAverages = this.calculateMovingAverages(data.prices);
    this.computeTrendFromMovingAverages(movingAverages, data.sortedUsd, results);
  }

  /**
   * Calcula las medias móviles de 14 y 30 días
   */
  private calculateMovingAverages(prices: number[]): {
    ma14: number[];
    ma30: number[];
  } {
    const ma14 = StatisticsService.simpleMovingAverage(prices, FxVolatilityUseCase.TREND_MA_SHORT);
    const ma30 = StatisticsService.simpleMovingAverage(prices, FxVolatilityUseCase.TREND_MA_LONG);

    return { ma14, ma30 };
  }

  /**
   * Calcula la tendencia a partir de las medias móviles
   */
  private computeTrendFromMovingAverages(
    movingAverages: { ma14: number[]; ma30: number[] },
    sortedUsd: SeriesPoint[],
    results: FxVolatilityResult[]
  ): void {
    const startIndex = FxVolatilityUseCase.TREND_MA_LONG - 1;
    const ma14StartIndex =
      startIndex - (FxVolatilityUseCase.TREND_MA_LONG - FxVolatilityUseCase.TREND_MA_SHORT);

    for (let i = startIndex; i < sortedUsd.length; i++) {
      const ma14Index = i - startIndex + ma14StartIndex;
      const ma30Index = i - startIndex;

      if (
        ma14Index >= 0 &&
        ma14Index < movingAverages.ma14.length &&
        ma30Index >= 0 &&
        ma30Index < movingAverages.ma30.length
      ) {
        const ma14Value = movingAverages.ma14[ma14Index];
        const ma30Value = movingAverages.ma30[ma30Index];

        // Validar que ambos valores sean números válidos y no NaN
        if (
          ma14Value !== undefined &&
          ma30Value !== undefined &&
          this.isValidNumber(ma14Value) &&
          this.isValidNumber(ma30Value)
        ) {
          const trend = this.computeTrendValue(ma14Value, ma30Value);

          // Solo persistir si el resultado es un número válido
          if (this.isValidNumber(trend)) {
            const ts = sortedUsd[i]!.ts;
            results.push(this.createTrendResult(ts, trend, ma14Value, ma30Value));
          }
        }
      }
    }
  }

  /**
   * Valida que un valor sea un número válido (no NaN, no Infinity)
   */
  private isValidNumber(value: number): boolean {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
  }

  /**
   * Calcula el valor de la tendencia
   */
  private computeTrendValue(ma14: number, ma30: number): number {
    return ma14 - ma30;
  }

  /**
   * Crea el resultado para la métrica de tendencia
   */
  private createTrendResult(
    ts: string,
    trend: number,
    ma14: number,
    ma30: number
  ): FxVolatilityResult {
    return {
      metricId: 'fx.trend_14v30.usd',
      ts,
      value: trend,
      metadata: {
        depends_on: [FxVolatilityUseCase.USD_SERIES_ID],
        window: '14v30',
        units: 'ARS',
        ma14_len: FxVolatilityUseCase.TREND_MA_SHORT,
        ma30_len: FxVolatilityUseCase.TREND_MA_LONG,
        ma_14: ma14,
        ma_30: ma30,
      },
    };
  }

  /**
   * Persiste los resultados en la base de datos
   */
  private async persistResults(results: FxVolatilityResult[]): Promise<void> {
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
      msg: 'FX volatility and trend metrics computed successfully',
      data: { count },
    });
  }
}
