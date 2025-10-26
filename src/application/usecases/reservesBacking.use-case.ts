import type { SeriesPoint } from '@/domain/entities/series.js';
import type { TargetMetricsRepository } from '@/infrastructure/db/metricsRepo.target.js';
import { logger } from '@/infrastructure/log/logger.js';
import { METRICS_COMPUTATION } from '@/infrastructure/log/log-events.js';
import { SeriesUtils } from '@/domain/utils/index.js';

export interface ReservesBackingInputs {
  reserves: SeriesPoint[];
  base: SeriesPoint[];
  usdOfficial: SeriesPoint[];
  leliq?: SeriesPoint[];
  pasesActivos?: SeriesPoint[];
  pasesPasivos?: SeriesPoint[];
}

export interface ReservesBackingResult {
  metricId: string;
  ts: string;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * Use case para calcular métricas de respaldo del peso
 * Calcula ratios de reservas vs base y pasivos vs reservas
 */
export class ReservesBackingUseCase {
  private static readonly MAIN_SERIES = ['1', '15', 'bcra.cambiarias.usd'] as const;
  private static readonly PASIVOS_SERIES = [
    '1',
    'bcra.cambiarias.usd',
    'bcra.leliq_total_ars',
    'bcra.pases_activos_total_ars',
    'bcra.pases_pasivos_total_ars',
  ] as const;

  constructor(private targetRepo: TargetMetricsRepository) {}

  /**
   * Ejecuta el cálculo de métricas de respaldo del peso
   */
  async execute(inputs: ReservesBackingInputs): Promise<ReservesBackingResult[]> {
    logger.info({
      event: METRICS_COMPUTATION.INIT,
      msg: 'Computing reserves backing metrics',
    });

    const results: ReservesBackingResult[] = [];

    // Calcular ratio reserves_to_base
    const reservesToBaseResults = this.calculateReservesToBaseRatio(inputs);
    results.push(...reservesToBaseResults);

    // Calcular ratio passives_vs_reserves si tenemos datos de pasivos
    if (this.hasPasivosData(inputs)) {
      const passivesResults = this.calculatePassivesVsReservesRatio(inputs);
      results.push(...passivesResults);
    }

    if (results.length > 0) {
      await this.persistResults(results);
      this.logSuccess(results.length);
    }

    return results;
  }

  /**
   * Verifica si tenemos datos de pasivos disponibles
   */
  private hasPasivosData(inputs: ReservesBackingInputs): boolean {
    return !!(inputs.leliq && inputs.pasesActivos && inputs.pasesPasivos);
  }

  /**
   * Calcula el ratio reserves_to_base
   */
  private calculateReservesToBaseRatio(inputs: ReservesBackingInputs): ReservesBackingResult[] {
    const alignedData = this.alignMainSeries(inputs);
    if (!alignedData) {
      this.logMainSeriesAlignmentFailure();
      return [];
    }

    const results: ReservesBackingResult[] = [];

    for (let i = 0; i < alignedData.reserves.length; i++) {
      const dailyData = this.extractMainSeriesData(alignedData, i);

      if (this.canCalculateReservesToBase(dailyData)) {
        const ratio = this.computeReservesToBaseRatio(dailyData);
        results.push(this.createReservesToBaseResult(dailyData, ratio));
      }
    }

    return results;
  }

  /**
   * Alinea las series principales (reservas, base, USD oficial)
   */
  private alignMainSeries(inputs: ReservesBackingInputs): {
    reserves: SeriesPoint[];
    base: SeriesPoint[];
    usdOfficial: SeriesPoint[];
  } | null {
    const alignedMain = SeriesUtils.alignSeries(
      SeriesUtils.alignSeries(inputs.reserves, inputs.base).series1,
      inputs.usdOfficial
    );

    const alignedReserves = alignedMain.series1;
    const alignedBase = SeriesUtils.alignSeries(inputs.base, inputs.usdOfficial).series2;
    const alignedUsdOfficial = alignedMain.series2;

    if (!alignedReserves || !alignedBase || !alignedUsdOfficial) {
      return null;
    }

    return {
      reserves: alignedReserves,
      base: alignedBase,
      usdOfficial: alignedUsdOfficial,
    };
  }

  /**
   * Registra cuando falla el alineamiento de series principales
   */
  private logMainSeriesAlignmentFailure(): void {
    logger.info({
      event: METRICS_COMPUTATION.METRIC_SKIPPED,
      msg: 'Failed to align main series for reserves backing metrics',
    });
  }

  /**
   * Extrae los datos de un día específico de las series principales
   */
  private extractMainSeriesData(
    alignedData: {
      reserves: SeriesPoint[];
      base: SeriesPoint[];
      usdOfficial: SeriesPoint[];
    },
    index: number
  ): {
    reserves: number;
    base: number;
    usdOfficial: number;
    ts: string;
  } {
    return {
      reserves: alignedData.reserves[index]!.value,
      base: alignedData.base[index]!.value,
      usdOfficial: alignedData.usdOfficial[index]!.value,
      ts: alignedData.reserves[index]!.ts,
    };
  }

  /**
   * Verifica si se puede calcular el ratio reserves_to_base
   */
  private canCalculateReservesToBase(dailyData: { usdOfficial: number }): boolean {
    return dailyData.usdOfficial > 0;
  }

  /**
   * Calcula el ratio reserves_to_base
   */
  private computeReservesToBaseRatio(dailyData: {
    reserves: number;
    base: number;
    usdOfficial: number;
  }): number {
    const baseInUsd = dailyData.base / dailyData.usdOfficial;
    return dailyData.reserves / baseInUsd;
  }

  /**
   * Crea el resultado para ratio reserves_to_base
   */
  private createReservesToBaseResult(
    dailyData: { reserves: number; base: number; usdOfficial: number; ts: string },
    ratio: number
  ): ReservesBackingResult {
    const baseInUsd = dailyData.base / dailyData.usdOfficial;

    return {
      metricId: 'ratio.reserves_to_base',
      ts: dailyData.ts,
      value: ratio,
      metadata: {
        depends_on: [...ReservesBackingUseCase.MAIN_SERIES],
        fx_official: 'A3500', // Asumiendo A3500, se puede hacer configurable
        reserves_usd: dailyData.reserves,
        base_ars: dailyData.base,
        usd_official: dailyData.usdOfficial,
        base_in_usd: baseInUsd,
        units: 'ratio',
      },
    };
  }

  /**
   * Calcula el ratio passives_vs_reserves
   */
  private calculatePassivesVsReservesRatio(inputs: ReservesBackingInputs): ReservesBackingResult[] {
    const alignedData = this.alignPasivosSeries(inputs);
    if (!alignedData) {
      this.logPasivosAlignmentFailure();
      return [];
    }

    const results: ReservesBackingResult[] = [];

    for (let i = 0; i < alignedData.reserves.length; i++) {
      const dailyData = this.extractPasivosData(alignedData, i);

      if (this.canCalculatePassivesVsReserves(dailyData)) {
        const ratio = this.computePassivesVsReservesRatio(dailyData);
        results.push(this.createPassivesVsReservesResult(dailyData, ratio));
      }
    }

    return results;
  }

  /**
   * Alinea las series de pasivos con reservas y USD oficial
   */
  private alignPasivosSeries(inputs: ReservesBackingInputs): {
    reserves: SeriesPoint[];
    usdOfficial: SeriesPoint[];
    leliq: SeriesPoint[];
    pasesActivos: SeriesPoint[];
    pasesPasivos: SeriesPoint[];
  } | null {
    // Primero alineamos las series principales
    const mainAligned = this.alignMainSeries(inputs);
    if (!mainAligned) {
      return null;
    }

    const alignedPasivos = SeriesUtils.alignMultipleSeries([
      mainAligned.reserves,
      mainAligned.usdOfficial,
      inputs.leliq!,
      inputs.pasesActivos!,
      inputs.pasesPasivos!,
    ]);

    const [
      alignedReserves,
      alignedUsdOfficial,
      alignedLeliq,
      alignedPasesActivos,
      alignedPasesPasivos,
    ] = alignedPasivos;

    if (
      !alignedReserves ||
      !alignedUsdOfficial ||
      !alignedLeliq ||
      !alignedPasesActivos ||
      !alignedPasesPasivos
    ) {
      return null;
    }

    return {
      reserves: alignedReserves,
      usdOfficial: alignedUsdOfficial,
      leliq: alignedLeliq,
      pasesActivos: alignedPasesActivos,
      pasesPasivos: alignedPasesPasivos,
    };
  }

  /**
   * Registra cuando falla el alineamiento de series de pasivos
   */
  private logPasivosAlignmentFailure(): void {
    logger.info({
      event: METRICS_COMPUTATION.METRIC_SKIPPED,
      msg: 'Failed to align pasivos series for reserves backing metrics',
    });
  }

  /**
   * Extrae los datos de un día específico de las series de pasivos
   */
  private extractPasivosData(
    alignedData: {
      reserves: SeriesPoint[];
      usdOfficial: SeriesPoint[];
      leliq: SeriesPoint[];
      pasesActivos: SeriesPoint[];
      pasesPasivos: SeriesPoint[];
    },
    index: number
  ): {
    reserves: number;
    usdOfficial: number;
    leliq: number;
    pasesActivos: number;
    pasesPasivos: number;
    ts: string;
  } {
    return {
      reserves: alignedData.reserves[index]!.value,
      usdOfficial: alignedData.usdOfficial[index]!.value,
      leliq: alignedData.leliq[index]!.value,
      pasesActivos: alignedData.pasesActivos[index]!.value,
      pasesPasivos: alignedData.pasesPasivos[index]!.value,
      ts: alignedData.reserves[index]!.ts,
    };
  }

  /**
   * Verifica si se puede calcular el ratio passives_vs_reserves
   */
  private canCalculatePassivesVsReserves(dailyData: { usdOfficial: number }): boolean {
    return dailyData.usdOfficial > 0;
  }

  /**
   * Calcula el ratio passives_vs_reserves
   */
  private computePassivesVsReservesRatio(dailyData: {
    reserves: number;
    usdOfficial: number;
    leliq: number;
    pasesActivos: number;
    pasesPasivos: number;
  }): number {
    const totalPasivos = dailyData.leliq + dailyData.pasesActivos + dailyData.pasesPasivos;
    const reservesInArs = dailyData.reserves * dailyData.usdOfficial;
    return totalPasivos / reservesInArs;
  }

  /**
   * Crea el resultado para ratio passives_vs_reserves
   */
  private createPassivesVsReservesResult(
    dailyData: {
      reserves: number;
      usdOfficial: number;
      leliq: number;
      pasesActivos: number;
      pasesPasivos: number;
      ts: string;
    },
    ratio: number
  ): ReservesBackingResult {
    const totalPasivos = dailyData.leliq + dailyData.pasesActivos + dailyData.pasesPasivos;
    const reservesInArs = dailyData.reserves * dailyData.usdOfficial;

    return {
      metricId: 'ratio.passives_vs_reserves',
      ts: dailyData.ts,
      value: ratio,
      metadata: {
        depends_on: [...ReservesBackingUseCase.PASIVOS_SERIES],
        fx_official: 'A3500',
        reserves_usd: dailyData.reserves,
        reserves_ars: reservesInArs,
        total_pasivos: totalPasivos,
        leliq: dailyData.leliq,
        pases_activos: dailyData.pasesActivos,
        pases_pasivos: dailyData.pasesPasivos,
        units: 'ratio',
      },
    };
  }

  /**
   * Persiste los resultados en la base de datos
   */
  private async persistResults(results: ReservesBackingResult[]): Promise<void> {
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
      msg: 'Reserves backing metrics computed successfully',
      data: { count },
    });
  }
}
