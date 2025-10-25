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
  leliq?: SeriesPoint[] | undefined;
  pasesPasivos?: SeriesPoint[] | undefined;
  pasesActivos?: SeriesPoint[] | undefined;
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
    results.push(...this.computeReserves5d(inputs));
    results.push(...this.computePasivosRem(inputs));
    results.push(...this.computeBaseAmpliada(inputs));
    results.push(...this.computeBrechaMep(inputs));
    results.push(...this.computeRespaldoReal(inputs));

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
    const [reservas, base, mep, tcOficialPref, leliq, pasesPasivos, pasesActivos] = await Promise.all([
      this.sourceRepo.getSeriesPoints('1', fromDate, toDate),
      this.sourceRepo.getSeriesPoints('15', fromDate, toDate),
      this.sourceRepo.getSeriesPoints('dolarapi.mep_ars', fromDate, toDate),
      this.sourceRepo.getSeriesPoints('bcra.usd_official_ars', fromDate, toDate),
      this.sourceRepo.getSeriesPoints('bcra.leliq_total_ars', fromDate, toDate),
      this.sourceRepo.getSeriesPoints('bcra.pases_pasivos_total_ars', fromDate, toDate),
      this.sourceRepo.getSeriesPoints('bcra.pases_activos_total_ars', fromDate, toDate),
    ]);

    return {
      reservas,
      base,
      mep: mep.length > 0 ? mep : undefined,
      tcOficialPref: tcOficialPref.length > 0 ? tcOficialPref : undefined,
      leliq: leliq.length > 0 ? leliq : undefined,
      pasesPasivos: pasesPasivos.length > 0 ? pasesPasivos : undefined,
      pasesActivos: pasesActivos.length > 0 ? pasesActivos : undefined,
    } as MetricInputs;
  }

  private hasRequiredInputs(inputs: MetricInputs): boolean {
    return inputs.reservas.length > 0 && inputs.base.length > 0;
  }

  private computeReservesToBase(inputs: MetricInputs): MetricResult[] {
    const results: MetricResult[] = [];

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

  private computeReserves5d(inputs: MetricInputs): MetricResult[] {
    const results: MetricResult[] = [];
    const sortedReservas = inputs.reservas.sort(
      (a, b) => DateService.parseDate(a.ts).getTime() - DateService.parseDate(b.ts).getTime()
    );

    for (let i = 5; i < sortedReservas.length; i++) {
      const current = sortedReservas[i];
      const previous = sortedReservas[i - 5];

      if (current && previous && previous.value !== 0) {
        const delta = (current.value - previous.value) / previous.value;
        results.push({
          metricId: 'delta.reserves_5d',
          ts: current.ts,
          value: delta,
          metadata: {
            current: current.value,
            previous: previous.value,
            lag_days: 5,
            base_ts: previous.ts,
            inputs: ['series:1'],
            window: '5d',
            units: 'ratio',
          },
        });
      }
    }

    return results;
  }

  private computePasivosRem(inputs: MetricInputs): MetricResult[] {
    const results: MetricResult[] = [];
    
    if (!inputs.leliq || !inputs.pasesPasivos || !inputs.pasesActivos) {
      return results;
    }

    const leliqMap = new Map(inputs.leliq.map(point => [point.ts, point.value]));
    const pasesPasivosMap = new Map(inputs.pasesPasivos.map(point => [point.ts, point.value]));
    const pasesActivosMap = new Map(inputs.pasesActivos.map(point => [point.ts, point.value]));

    const allDates = new Set([
      ...leliqMap.keys(),
      ...pasesPasivosMap.keys(),
      ...pasesActivosMap.keys(),
    ]);

    for (const date of allDates) {
      const leliqValue = leliqMap.get(date) || 0;
      const pasesPasivosValue = pasesPasivosMap.get(date) || 0;
      const pasesActivosValue = pasesActivosMap.get(date) || 0;

      const total = leliqValue + pasesPasivosValue + pasesActivosValue;
      const missingComponents = [];

      if (!leliqMap.has(date)) missingComponents.push('leliq');
      if (!pasesPasivosMap.has(date)) missingComponents.push('pases_pasivos');
      if (!pasesActivosMap.has(date)) missingComponents.push('pases_activos');

      results.push({
        metricId: 'mon.pasivos_rem_ars',
        ts: date,
        value: total,
        metadata: {
          leliq: leliqValue,
          pases_pasivos: pasesPasivosValue,
          pases_activos: pasesActivosValue,
          inputs: ['leliq', 'pases_pasivos', 'pases_activos'],
          missing_components: missingComponents,
        },
      });
    }

    return results;
  }

  private computeBaseAmpliada(inputs: MetricInputs): MetricResult[] {
    const results: MetricResult[] = [];
    
    const baseMap = new Map(inputs.base.map(point => [point.ts, point.value]));
    
    const pasivosRemResults = this.computePasivosRem(inputs);
    const pasivosRemMap = new Map(pasivosRemResults.map(result => [result.ts, result.value]));

    for (const [date, baseValue] of baseMap) {
      const pasivosValue = pasivosRemMap.get(date) || 0;
      const baseAmpliada = baseValue + pasivosValue;

      results.push({
        metricId: 'mon.base_ampliada_ars',
        ts: date,
        value: baseAmpliada,
        metadata: {
          base: baseValue,
          pasivos_rem: pasivosValue,
          inputs: ['base', 'mon.pasivos_rem_ars'],
        },
      });
    }

    return results;
  }

  private selectOfficialFx(ts: string, inputs: MetricInputs): { value: number; source: 'bcra' | 'datos' } | null {
    if (inputs.tcOficialPref) {
      const oficialPoint = inputs.tcOficialPref.find(point => point.ts === ts);
      if (oficialPoint) {
        return { value: oficialPoint.value, source: 'bcra' };
      }
    }

    if (inputs.mep) {
      const mepPoint = inputs.mep.find(point => point.ts === ts);
      if (mepPoint) {
        return { value: mepPoint.value, source: 'datos' };
      }
    }

    return null;
  }

  private computeBrechaMep(inputs: MetricInputs): MetricResult[] {
    const results: MetricResult[] = [];

    if (!inputs.mep) {
      return results;
    }

    for (const mepPoint of inputs.mep) {
      const oficialFx = this.selectOfficialFx(mepPoint.ts, inputs);
      
      if (oficialFx && oficialFx.value !== 0) {
        const brecha = (mepPoint.value - oficialFx.value) / oficialFx.value;
        results.push({
          metricId: 'fx.brecha_mep',
          ts: mepPoint.ts,
          value: brecha,
          metadata: {
            mep: mepPoint.value,
            oficial: oficialFx.value,
            inputs: ['mep', 'oficial'],
            oficial_fx_source: oficialFx.source,
            units: 'ratio',
          },
        });
      }
    }

    return results;
  }

  private computeRespaldoReal(inputs: MetricInputs): MetricResult[] {
    const results: MetricResult[] = [];

    const reservasMap = new Map(inputs.reservas.map(point => [point.ts, point.value]));
    
    const baseAmpliadaResults = this.computeBaseAmpliada(inputs);
    const baseAmpliadaMap = new Map(baseAmpliadaResults.map(result => [result.ts, result.value]));

    for (const [date, reservasValue] of reservasMap) {
      const baseAmpliadaValue = baseAmpliadaMap.get(date);
      const oficialFx = this.selectOfficialFx(date, inputs);

      if (baseAmpliadaValue && oficialFx && oficialFx.value !== 0) {
        const respaldoReal = reservasValue / (baseAmpliadaValue / oficialFx.value);
        results.push({
          metricId: 'mon.respaldo_real',
          ts: date,
          value: respaldoReal,
          metadata: {
            reservas: reservasValue,
            base_ampliada: baseAmpliadaValue,
            oficial: oficialFx.value,
            inputs: ['reservas', 'base', 'pasivos', 'oficial'],
            oficial_fx_source: oficialFx.source,
            units: 'ratio',
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
