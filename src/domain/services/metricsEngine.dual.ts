import type { SeriesPoint } from '@/domain/entities/series.js';
import type { SourceSeriesRepository } from '@/infrastructure/db/seriesRepo.source.js';
import type { TargetMetricsRepository } from '@/infrastructure/db/metricsRepo.target.js';
import { logger } from '@/infrastructure/log/logger.js';
import { METRICS_COMPUTATION } from '@/infrastructure/log/log-events.js';
import { DateService } from '@/domain/utils/dateService.js';

export interface MetricInputs {
  reservas: SeriesPoint[];
  base: SeriesPoint[];
  mep?: SeriesPoint[] | undefined;
  tcOficialPref?: SeriesPoint[] | undefined;
}

export interface MetricResult {
  metricId: string;
  ts: string;
  value: number;
  metadata?: Record<string, unknown>;
}

export class DualDatabaseMetricsEngine {
  constructor(
    private sourceRepo: SourceSeriesRepository,
    private targetRepo: TargetMetricsRepository
  ) {}

  async computeMetricsForRange(fromDate: string, toDate: string): Promise<MetricResult[]> {
    logger.info({
      event: METRICS_COMPUTATION.INIT,
      msg: 'Starting metrics computation',
    });

    const inputs = await this.loadInputs(fromDate, toDate);

    if (!this.hasRequiredInputs(inputs)) {
      return [];
    }

    const results: MetricResult[] = [];

    results.push(...this.computeReservesToBase(inputs));
    results.push(...this.computeReserves7d(inputs));
    results.push(...this.computeBase30d(inputs));

    if (inputs.mep && inputs.tcOficialPref) {
      results.push(...this.computeBrechaMepOficial(inputs));
    }

    if (results.length > 0) {
      const metricsPoints = results.map(result => ({
        metric_id: result.metricId,
        ts: result.ts,
        value: result.value,
        ...(result.metadata && { metadata: result.metadata }),
      }));

      await this.targetRepo.upsertMetricsPoints(metricsPoints);
      logger.info({
        event: METRICS_COMPUTATION.FINISHED,
        msg: 'Metrics computation completed',
        data: { computed: results.length },
      });
    }

    return results;
  }

  private async loadInputs(fromDate: string, toDate: string): Promise<MetricInputs> {
    const [reservas, base, mep, tcOficialPref] = await Promise.all([
      this.sourceRepo.getSeriesPoints('1', fromDate, toDate),
      this.sourceRepo.getSeriesPoints('15', fromDate, toDate),
      this.sourceRepo.getSeriesPoints('dolarapi.mep_ars', fromDate, toDate),
      this.sourceRepo.getSeriesPoints('bcra.usd_official_ars', fromDate, toDate),
    ]);

    return {
      reservas,
      base,
      mep: mep.length > 0 ? mep : undefined,
      tcOficialPref: tcOficialPref.length > 0 ? tcOficialPref : undefined,
    } as MetricInputs;
  }

  private hasRequiredInputs(inputs: MetricInputs): boolean {
    return inputs.reservas.length > 0 && inputs.base.length > 0;
  }

  private computeReservesToBase(inputs: MetricInputs): MetricResult[] {
    const results: MetricResult[] = [];

    // Create a map of dates for efficient lookup (normalize to date string)
    const baseMap = new Map(
      inputs.base.map(point => {
        const dateStr =
          typeof point.ts === 'string'
            ? point.ts.split('T')[0]
            : DateService.formatDate(new Date(point.ts));
        return [dateStr, point.value];
      })
    );

    for (const reserva of inputs.reservas) {
      const reservaDate =
        typeof reserva.ts === 'string'
          ? reserva.ts.split('T')[0]
          : DateService.formatDate(new Date(reserva.ts));
      const baseValue = baseMap.get(reservaDate);

      if (baseValue && baseValue !== 0) {
        const ratio = reserva.value / baseValue;
        results.push({
          metricId: 'ratio.reserves_to_base',
          ts: reserva.ts,
          value: ratio,
          metadata: {
            reserves: reserva.value,
            base: baseValue,
          },
        });
      }
    }

    return results;
  }

  private computeReserves7d(inputs: MetricInputs): MetricResult[] {
    const results: MetricResult[] = [];
    const sortedReservas = inputs.reservas.sort(
      (a, b) => DateService.parseDate(a.ts).getTime() - DateService.parseDate(b.ts).getTime()
    );

    for (let i = 7; i < sortedReservas.length; i++) {
      const current = sortedReservas[i];
      const previous = sortedReservas[i - 7];

      if (current && previous && previous.value !== 0) {
        const delta = (current.value - previous.value) / previous.value;
        results.push({
          metricId: 'delta.reserves_7d',
          ts: current.ts,
          value: delta,
          metadata: {
            current: current.value,
            previous: previous.value,
            lag_days: 7,
          },
        });
      }
    }

    return results;
  }

  private computeBase30d(inputs: MetricInputs): MetricResult[] {
    const results: MetricResult[] = [];
    const sortedBase = inputs.base.sort(
      (a, b) => DateService.parseDate(a.ts).getTime() - DateService.parseDate(b.ts).getTime()
    );

    for (let i = 30; i < sortedBase.length; i++) {
      const current = sortedBase[i];
      const previous = sortedBase[i - 30];

      if (current && previous && previous.value !== 0) {
        const delta = (current.value - previous.value) / previous.value;
        results.push({
          metricId: 'delta.base_30d',
          ts: current.ts,
          value: delta,
          metadata: {
            current: current.value,
            previous: previous.value,
            lag_days: 30,
          },
        });
      }
    }

    return results;
  }

  private computeBrechaMepOficial(inputs: MetricInputs): MetricResult[] {
    const results: MetricResult[] = [];

    if (!inputs.mep || !inputs.tcOficialPref) {
      return results;
    }

    const mepMap = new Map(inputs.mep.map(point => [point.ts, point.value]));
    const oficialMap = new Map(inputs.tcOficialPref.map(point => [point.ts, point.value]));

    for (const [date, mepValue] of mepMap) {
      const oficialValue = oficialMap.get(date);
      if (oficialValue && oficialValue !== 0) {
        const brecha = (mepValue - oficialValue) / oficialValue;
        results.push({
          metricId: 'brecha.mep_oficial',
          ts: date,
          value: brecha,
          metadata: {
            mep: mepValue,
            oficial: oficialValue,
          },
        });
      }
    }

    return results;
  }
}
