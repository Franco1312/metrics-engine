import type { SeriesPoint } from '@/domain/entities/series.js';
import type { TargetMetricsRepository } from '@/infrastructure/db/metricsRepo.target.js';
import { logger } from '@/infrastructure/log/logger.js';
import { METRICS_COMPUTATION } from '@/infrastructure/log/log-events.js';
import { SeriesUtils } from '@/domain/utils/index.js';

export interface FxLocalPressureInputs {
  usd: SeriesPoint[];
  brl?: SeriesPoint[];
  clp?: SeriesPoint[];
  mxn?: SeriesPoint[];
  cop?: SeriesPoint[];
}

export interface FxLocalPressureResult {
  metricId: string;
  ts: string;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * Use case para calcular presión local vs externa del USD
 * Calcula la diferencia entre la normalización del USD y la normalización de la canasta de monedas
 */
export class FxLocalPressureUseCase {
  private static readonly WINDOW_SIZE = 30; // Días hábiles
  private static readonly USD_SERIES_ID = 'bcra.cambiarias.usd';
  private static readonly BASKET_CURRENCIES_IDS = [
    'bcra.cambiarias.brl',
    'bcra.cambiarias.clp',
    'bcra.cambiarias.mxn',
    'bcra.cambiarias.cop',
  ];

  constructor(private targetRepo: TargetMetricsRepository) {}

  /**
   * Ejecuta el cálculo de la presión local FX
   */
  async execute(inputs: FxLocalPressureInputs): Promise<FxLocalPressureResult[]> {
    logger.info({
      event: METRICS_COMPUTATION.INIT,
      msg: 'Computing FX local pressure metrics',
    });

    const results: FxLocalPressureResult[] = [];

    const basketCurrencies = this.getAvailableBasketCurrencies(inputs);
    if (!this.validateBasketCurrencies(basketCurrencies)) {
      return results;
    }

    const alignedData = this.alignAllSeries(inputs, basketCurrencies);
    if (!this.validateAlignedData(alignedData)) {
      return results;
    }

    this.calculateLocalPressureForAlignedData(alignedData!, results);

    if (results.length > 0) {
      await this.persistResults(results);
      this.logSuccess(results.length);
    }

    return results;
  }

  /**
   * Obtiene las monedas de la canasta disponibles
   */
  private getAvailableBasketCurrencies(inputs: FxLocalPressureInputs): SeriesPoint[][] {
    const available: SeriesPoint[][] = [];
    if (inputs.brl && inputs.brl.length > 0) available.push(inputs.brl);
    if (inputs.clp && inputs.clp.length > 0) available.push(inputs.clp);
    if (inputs.mxn && inputs.mxn.length > 0) available.push(inputs.mxn);
    if (inputs.cop && inputs.cop.length > 0) available.push(inputs.cop);
    return available;
  }

  /**
   * Valida que tenemos suficientes monedas de la canasta
   */
  private validateBasketCurrencies(basketCurrencies: SeriesPoint[][]): boolean {
    if (basketCurrencies.length < 2) {
      logger.info({
        event: METRICS_COMPUTATION.METRIC_SKIPPED,
        msg: 'Insufficient basket currencies for local pressure calculation',
        data: { availableCurrencies: basketCurrencies.length, required: 2 },
      });
      return false;
    }
    return true;
  }

  /**
   * Alinea todas las series por fecha
   */
  private alignAllSeries(
    inputs: FxLocalPressureInputs,
    basketCurrencies: SeriesPoint[][]
  ): {
    alignedUsd: SeriesPoint[];
    alignedBasket: SeriesPoint[][];
  } | null {
    const allSeries = [inputs.usd, ...basketCurrencies];
    const alignedSeries = SeriesUtils.alignMultipleSeries(allSeries);

    if (!alignedSeries[0] || alignedSeries[0].length === 0) {
      return null;
    }

    const [alignedUsd, ...alignedBasket] = alignedSeries as [SeriesPoint[], ...SeriesPoint[][]];
    return { alignedUsd, alignedBasket };
  }

  /**
   * Valida que los datos alineados son suficientes
   */
  private validateAlignedData(
    alignedData: {
      alignedUsd: SeriesPoint[];
      alignedBasket: SeriesPoint[][];
    } | null
  ): boolean {
    if (!alignedData) {
      logger.info({
        event: METRICS_COMPUTATION.METRIC_SKIPPED,
        msg: 'Failed to align series for local pressure calculation',
      });
      return false;
    }

    if (alignedData.alignedUsd.length < FxLocalPressureUseCase.WINDOW_SIZE) {
      logger.info({
        event: METRICS_COMPUTATION.METRIC_SKIPPED,
        msg: 'Insufficient data points for local pressure calculation',
        data: {
          dataPoints: alignedData.alignedUsd.length,
          required: FxLocalPressureUseCase.WINDOW_SIZE,
        },
      });
      return false;
    }

    return true;
  }

  /**
   * Calcula la presión local para los datos alineados
   */
  private calculateLocalPressureForAlignedData(
    alignedData: { alignedUsd: SeriesPoint[]; alignedBasket: SeriesPoint[][] },
    results: FxLocalPressureResult[]
  ): void {
    const basketPrices = alignedData.alignedBasket.map(series => series.map(point => point.value));
    const usdPrices = alignedData.alignedUsd.map(point => point.value);

    for (let i = FxLocalPressureUseCase.WINDOW_SIZE - 1; i < alignedData.alignedUsd.length; i++) {
      this.parseDate(alignedData.alignedUsd[i]!.ts);
      const referenceIndex = i - FxLocalPressureUseCase.WINDOW_SIZE + 1;

      const usdNormalization = this.calculateUsdNormalization(usdPrices, i, referenceIndex);
      if (usdNormalization === null) {
        this.logUsdNormalizationFailure(alignedData.alignedUsd[i]!.ts);
        continue;
      }

      const basketNormalization = this.calculateBasketNormalization(
        basketPrices,
        i,
        referenceIndex
      );
      if (basketNormalization === null) {
        this.logBasketNormalizationFailure(alignedData.alignedUsd[i]!.ts);
        continue;
      }

      const localPressure = this.computeLocalPressure(usdNormalization, basketNormalization);
      results.push(
        this.createLocalPressureResult(
          alignedData.alignedUsd[i]!.ts,
          localPressure,
          usdNormalization,
          basketNormalization
        )
      );
    }
  }

  /**
   * Calcula la normalización del USD
   */
  private calculateUsdNormalization(
    usdPrices: number[],
    currentIndex: number,
    referenceIndex: number
  ): number | null {
    const currentPrice = usdPrices[currentIndex];
    const referencePrice = usdPrices[referenceIndex];

    if (currentPrice === undefined || referencePrice === undefined) {
      return null;
    }

    return this.normalizeValue(currentPrice, referencePrice);
  }

  /**
   * Calcula la normalización de la canasta de monedas
   */
  private calculateBasketNormalization(
    basketPrices: number[][],
    currentIndex: number,
    referenceIndex: number
  ): number | null {
    const currentBasketValues = basketPrices.map(series => series[currentIndex]);
    const referenceBasketValues = basketPrices.map(series => series[referenceIndex]);

    const basketNormalizations = currentBasketValues
      .map((current, idx) => {
        const ref = referenceBasketValues[idx];
        if (current === undefined || ref === undefined) {
          return null;
        }
        return this.normalizeValue(current, ref);
      })
      .filter(norm => norm !== null) as number[];

    if (basketNormalizations.length === 0) {
      return null;
    }

    const average =
      basketNormalizations.reduce((sum, val) => sum + val, 0) / basketNormalizations.length;
    return average;
  }

  /**
   * Normaliza un valor respecto a su referencia
   */
  private normalizeValue(current: number, reference: number): number | null {
    if (reference === 0) {
      return null;
    }
    return current / reference - 1;
  }

  /**
   * Calcula la presión local como diferencia entre normalizaciones
   */
  private computeLocalPressure(usdNormalization: number, basketNormalization: number): number {
    return usdNormalization - basketNormalization;
  }

  /**
   * Crea el resultado para la métrica de presión local
   */
  private createLocalPressureResult(
    ts: string,
    localPressure: number,
    usdNormalization: number,
    basketNormalization: number
  ): FxLocalPressureResult {
    return {
      metricId: 'fx.local_pressure_30d.usd',
      ts,
      value: localPressure,
      metadata: {
        depends_on: [
          FxLocalPressureUseCase.USD_SERIES_ID,
          ...FxLocalPressureUseCase.BASKET_CURRENCIES_IDS,
        ],
        window: '30d',
        usd_normalization: usdNormalization,
        basket_normalization: basketNormalization,
        units: 'ratio',
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
   * Registra cuando falla la normalización del USD
   */
  private logUsdNormalizationFailure(ts: string): void {
    logger.info({
      event: METRICS_COMPUTATION.METRIC_SKIPPED,
      msg: `Skipping fx.local_pressure_30d.usd for ${ts} due to invalid USD normalization`,
    });
  }

  /**
   * Registra cuando falla la normalización de la canasta
   */
  private logBasketNormalizationFailure(ts: string): void {
    logger.info({
      event: METRICS_COMPUTATION.METRIC_SKIPPED,
      msg: `Skipping fx.local_pressure_30d.usd for ${ts} due to invalid basket normalization`,
    });
  }

  /**
   * Persiste los resultados en la base de datos
   */
  private async persistResults(results: FxLocalPressureResult[]): Promise<void> {
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
      msg: 'FX local pressure metrics computed successfully',
      data: { count },
    });
  }
}
