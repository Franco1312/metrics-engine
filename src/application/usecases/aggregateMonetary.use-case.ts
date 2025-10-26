import type { SeriesPoint } from '@/domain/entities/series.js';
import type { TargetMetricsRepository } from '@/infrastructure/db/metricsRepo.target.js';
import { logger } from '@/infrastructure/log/logger.js';
import { METRICS_COMPUTATION } from '@/infrastructure/log/log-events.js';
import { SeriesUtils } from '@/domain/utils/index.js';

export interface AggregateMonetaryInputs {
  base: SeriesPoint[];
  leliq?: SeriesPoint[];
  pasesActivos?: SeriesPoint[];
  pasesPasivos?: SeriesPoint[];
}

export interface AggregateMonetaryResult {
  metricId: string;
  ts: string;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * Use case para calcular agregados monetarios
 * Calcula Base Ampliada y ratios de liquidez interna
 */
export class AggregateMonetaryUseCase {
  private static readonly REQUIRED_SERIES = [
    '15', // Base monetaria
    'bcra.leliq_total_ars', // LELIQ
    'bcra.pases_activos_total_ars', // Pases activos
    'bcra.pases_pasivos_total_ars', // Pases pasivos
  ] as const;

  constructor(private targetRepo: TargetMetricsRepository) {}

  /**
   * Ejecuta el cálculo de agregados monetarios
   */
  async execute(inputs: AggregateMonetaryInputs): Promise<AggregateMonetaryResult[]> {
    logger.info({
      event: METRICS_COMPUTATION.INIT,
      msg: 'Computing aggregate monetary metrics',
    });

    if (!this.hasRequiredData(inputs)) {
      this.logMissingData(inputs);
      return [];
    }

    const alignedData = this.alignMonetarySeries(inputs);
    if (!alignedData) {
      this.logAlignmentFailure();
      return [];
    }

    const results = this.calculateMonetaryAggregates(alignedData);

    if (results.length > 0) {
      await this.persistResults(results);
      this.logSuccess(results.length);
    }

    return results;
  }

  /**
   * Verifica que tenemos todos los datos necesarios
   */
  private hasRequiredData(inputs: AggregateMonetaryInputs): boolean {
    return !!(inputs.leliq && inputs.pasesActivos && inputs.pasesPasivos);
  }

  /**
   * Registra cuando faltan datos requeridos
   */
  private logMissingData(inputs: AggregateMonetaryInputs): void {
    logger.info({
      event: METRICS_COMPUTATION.METRIC_SKIPPED,
      msg: 'Missing required data for aggregate monetary metrics',
      data: {
        hasLeliq: !!inputs.leliq,
        hasPasesActivos: !!inputs.pasesActivos,
        hasPasesPasivos: !!inputs.pasesPasivos,
      },
    });
  }

  /**
   * Alinea todas las series monetarias por fecha
   */
  private alignMonetarySeries(inputs: AggregateMonetaryInputs): {
    base: SeriesPoint[];
    leliq: SeriesPoint[];
    pasesActivos: SeriesPoint[];
    pasesPasivos: SeriesPoint[];
  } | null {
    const alignedSeries = SeriesUtils.alignMultipleSeries([
      inputs.base,
      inputs.leliq!,
      inputs.pasesActivos!,
      inputs.pasesPasivos!,
    ]);

    const [alignedBase, alignedLeliq, alignedPasesActivos, alignedPasesPasivos] = alignedSeries;

    if (!alignedBase || !alignedLeliq || !alignedPasesActivos || !alignedPasesPasivos) {
      return null;
    }

    return {
      base: alignedBase,
      leliq: alignedLeliq,
      pasesActivos: alignedPasesActivos,
      pasesPasivos: alignedPasesPasivos,
    };
  }

  /**
   * Registra cuando falla el alineamiento de series
   */
  private logAlignmentFailure(): void {
    logger.info({
      event: METRICS_COMPUTATION.METRIC_SKIPPED,
      msg: 'Failed to align series for aggregate monetary metrics',
    });
  }

  /**
   * Calcula todos los agregados monetarios
   */
  private calculateMonetaryAggregates(alignedData: {
    base: SeriesPoint[];
    leliq: SeriesPoint[];
    pasesActivos: SeriesPoint[];
    pasesPasivos: SeriesPoint[];
  }): AggregateMonetaryResult[] {
    const results: AggregateMonetaryResult[] = [];

    for (let i = 0; i < alignedData.base.length; i++) {
      const dailyData = this.extractDailyData(alignedData, i);
      const aggregates = this.computeDailyAggregates(dailyData);
      results.push(...aggregates);
    }

    return results;
  }

  /**
   * Extrae los datos de un día específico
   */
  private extractDailyData(
    alignedData: {
      base: SeriesPoint[];
      leliq: SeriesPoint[];
      pasesActivos: SeriesPoint[];
      pasesPasivos: SeriesPoint[];
    },
    index: number
  ): {
    base: number;
    leliq: number;
    pasesActivos: number;
    pasesPasivos: number;
    ts: string;
  } {
    return {
      base: alignedData.base[index]!.value,
      leliq: alignedData.leliq[index]!.value,
      pasesActivos: alignedData.pasesActivos[index]!.value,
      pasesPasivos: alignedData.pasesPasivos[index]!.value,
      ts: alignedData.base[index]!.ts,
    };
  }

  /**
   * Calcula los agregados para un día específico
   */
  private computeDailyAggregates(dailyData: {
    base: number;
    leliq: number;
    pasesActivos: number;
    pasesPasivos: number;
    ts: string;
  }): AggregateMonetaryResult[] {
    const results: AggregateMonetaryResult[] = [];

    // Calcular Base Ampliada
    const baseAmpliada = this.calculateBaseAmpliada(dailyData);
    results.push(this.createBaseAmpliadaResult(dailyData, baseAmpliada));

    // Calcular ratio Base vs Base Ampliada (solo si base ampliada > 0)
    if (baseAmpliada > 0) {
      const ratio = this.calculateBaseRatio(dailyData.base, baseAmpliada);
      results.push(this.createBaseRatioResult(dailyData, ratio, baseAmpliada));
    }

    return results;
  }

  /**
   * Calcula la Base Ampliada (Base + LELIQ + Pases Activos + Pases Pasivos)
   * Todas las componentes se normalizan a millones de ARS antes de sumar
   */
  private calculateBaseAmpliada(dailyData: {
    base: number;
    leliq: number;
    pasesActivos: number;
    pasesPasivos: number;
  }): number {
    // Normalizar todas las componentes a millones de ARS
    const baseMillions = this.normalizeToMillions(dailyData.base);
    const leliqMillions = this.normalizeToMillions(dailyData.leliq);
    const pasesActivosMillions = this.normalizeToMillions(dailyData.pasesActivos);
    const pasesPasivosMillions = this.normalizeToMillions(dailyData.pasesPasivos);

    return baseMillions + leliqMillions + pasesActivosMillions + pasesPasivosMillions;
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
   * Calcula el ratio Base vs Base Ampliada usando valores normalizados
   */
  private calculateBaseRatio(base: number, baseAmpliada: number): number {
    const baseMillions = this.normalizeToMillions(base);
    return baseMillions / baseAmpliada;
  }

  /**
   * Crea el resultado para Base Ampliada
   */
  private createBaseAmpliadaResult(
    dailyData: {
      base: number;
      leliq: number;
      pasesActivos: number;
      pasesPasivos: number;
      ts: string;
    },
    baseAmpliada: number
  ): AggregateMonetaryResult {
    // Normalizar valores para metadata
    const baseMillions = this.normalizeToMillions(dailyData.base);
    const leliqMillions = this.normalizeToMillions(dailyData.leliq);
    const pasesActivosMillions = this.normalizeToMillions(dailyData.pasesActivos);
    const pasesPasivosMillions = this.normalizeToMillions(dailyData.pasesPasivos);

    return {
      metricId: 'mon.base_ampliada_ars',
      ts: dailyData.ts,
      value: baseAmpliada,
      metadata: {
        depends_on: [...AggregateMonetaryUseCase.REQUIRED_SERIES],
        units: 'million_ARS',
        scale: 'million',
        note: 'all components normalized to million ARS before sum',
        base: baseMillions,
        leliq: leliqMillions,
        pases_activos: pasesActivosMillions,
        pases_pasivos: pasesPasivosMillions,
      },
    };
  }

  /**
   * Crea el resultado para el ratio Base vs Base Ampliada
   */
  private createBaseRatioResult(
    dailyData: { base: number; ts: string },
    ratio: number,
    baseAmpliada: number
  ): AggregateMonetaryResult {
    const baseMillions = this.normalizeToMillions(dailyData.base);

    return {
      metricId: 'ratio.base_vs_base_ampliada',
      ts: dailyData.ts,
      value: ratio,
      metadata: {
        depends_on: [...AggregateMonetaryUseCase.REQUIRED_SERIES],
        units: 'ratio',
        scale: 'million',
        note: 'base and base_ampliada normalized to million ARS',
        base: baseMillions,
        base_ampliada: baseAmpliada,
      },
    };
  }

  /**
   * Persiste los resultados en la base de datos
   */
  private async persistResults(results: AggregateMonetaryResult[]): Promise<void> {
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
      msg: 'Aggregate monetary metrics computed successfully',
      data: { count },
    });
  }
}
