import { SourceSeriesRepositoryImpl } from '@/infrastructure/db/seriesRepo.source.js';
import { TargetMetricsRepositoryImpl } from '@/infrastructure/db/metricsRepo.target.js';
import { logger } from '@/infrastructure/log/logger.js';
import { METRICS_COMPUTATION } from '@/infrastructure/log/log-events.js';
import { DateService } from '@/domain/utils/dateService.js';
import {
  DeltaBaseUseCase,
  DeltaReservesUseCase,
  AggregateMonetaryUseCase,
  ReservesBackingUseCase,
  FxVolatilityUseCase,
  FxLocalPressureUseCase,
  DataHealthUseCase,
} from './index.js';

export interface ComputeMetricsParams {
  fromDate: string;
  toDate: string;
}

export class DualComputeMetricsUseCase {
  private sourceRepo: SourceSeriesRepositoryImpl;
  private targetRepo: TargetMetricsRepositoryImpl;
  private useCases: {
    deltaBase: DeltaBaseUseCase;
    deltaReserves: DeltaReservesUseCase;
    aggregateMonetary: AggregateMonetaryUseCase;
    reservesBacking: ReservesBackingUseCase;
    fxVolatility: FxVolatilityUseCase;
    fxLocalPressure: FxLocalPressureUseCase;
    dataHealth: DataHealthUseCase;
  };

  constructor() {
    this.sourceRepo = new SourceSeriesRepositoryImpl();
    this.targetRepo = new TargetMetricsRepositoryImpl();

    this.useCases = {
      deltaBase: new DeltaBaseUseCase(this.targetRepo),
      deltaReserves: new DeltaReservesUseCase(this.targetRepo),
      aggregateMonetary: new AggregateMonetaryUseCase(this.targetRepo),
      reservesBacking: new ReservesBackingUseCase(this.targetRepo),
      fxVolatility: new FxVolatilityUseCase(this.targetRepo),
      fxLocalPressure: new FxLocalPressureUseCase(this.targetRepo),
      dataHealth: new DataHealthUseCase(this.targetRepo),
    };
  }

  async execute(params: ComputeMetricsParams): Promise<void> {
    const { fromDate, toDate } = params;

    logger.info({
      event: METRICS_COMPUTATION.INIT,
      msg: 'Starting dual database metrics computation',
      data: { fromDate, toDate },
    });

    try {
      // Cargar datos de todas las series necesarias
      const [reserves, base, leliq, pasesActivos, pasesPasivos, usdOfficial, brl, clp, mxn, cop] =
        await Promise.all([
          this.sourceRepo.getSeriesPoints('1', fromDate, toDate),
          this.sourceRepo.getSeriesPoints('15', fromDate, toDate),
          this.sourceRepo.getSeriesPoints('bcra.leliq_total_ars', fromDate, toDate),
          this.sourceRepo.getSeriesPoints('bcra.pases_activos_total_ars', fromDate, toDate),
          this.sourceRepo.getSeriesPoints('bcra.pases_pasivos_total_ars', fromDate, toDate),
          this.sourceRepo.getSeriesPoints('bcra.cambiarias.usd', fromDate, toDate),
          this.sourceRepo.getSeriesPoints('bcra.cambiarias.brl', fromDate, toDate),
          this.sourceRepo.getSeriesPoints('bcra.cambiarias.clp', fromDate, toDate),
          this.sourceRepo.getSeriesPoints('bcra.cambiarias.mxn', fromDate, toDate),
          this.sourceRepo.getSeriesPoints('bcra.cambiarias.cop', fromDate, toDate),
        ]);

      // Verificar datos mínimos requeridos
      if (reserves.length === 0 || base.length === 0) {
        logger.info({
          event: METRICS_COMPUTATION.METRIC_SKIPPED,
          msg: 'Insufficient core data for metrics computation',
          data: {
            reserves: reserves.length,
            base: base.length,
            fromDate,
            toDate,
          },
        });
        return;
      }

      // Ejecutar todos los use cases en paralelo
      const results = await Promise.all([
        // Deltas monetarios
        this.useCases.deltaBase.execute({ base }),
        this.useCases.deltaReserves.execute({ reserves }),

        // Agregados monetarios
        this.useCases.aggregateMonetary.execute({
          base,
          leliq,
          pasesActivos,
          pasesPasivos,
        }),

        // Respaldo del peso
        this.useCases.reservesBacking.execute({
          reserves,
          base,
          usdOfficial,
          leliq,
          pasesActivos,
          pasesPasivos,
        }),

        // Volatilidad y tendencia FX
        this.useCases.fxVolatility.execute({ usdOfficial }),

        // Presión local vs externa
        this.useCases.fxLocalPressure.execute({
          usd: usdOfficial,
          brl,
          clp,
          mxn,
          cop,
        }),

        // Calidad de datos
        this.useCases.dataHealth.execute({
          series: [
            { seriesId: '1', points: reserves },
            { seriesId: '15', points: base },
            { seriesId: 'bcra.leliq_total_ars', points: leliq },
            { seriesId: 'bcra.pases_activos_total_ars', points: pasesActivos },
            { seriesId: 'bcra.pases_pasivos_total_ars', points: pasesPasivos },
            { seriesId: 'bcra.cambiarias.usd', points: usdOfficial },
          ],
        }),
      ]);

      const totalResults = results.reduce((sum, result) => sum + result.length, 0);

      logger.info({
        event: METRICS_COMPUTATION.FINISHED,
        msg: 'Dual database metrics computation completed',
        data: {
          computed: totalResults,
          fromDate,
          toDate,
          metrics: {
            deltaBase: results[0].length,
            deltaReserves: results[1].length,
            aggregateMonetary: results[2].length,
            reservesBacking: results[3].length,
            fxVolatility: results[4].length,
            fxLocalPressure: results[5].length,
            dataHealth: results[6].length,
          },
        },
      });
    } catch (error) {
      logger.error({
        event: METRICS_COMPUTATION.ERROR,
        msg: 'Dual database metrics computation failed',
        err: error as Error,
        data: { fromDate, toDate },
      });
      throw error;
    }
  }

  async recomputeRecentWindow(days: number = 30): Promise<void> {
    const today = new Date();
    const fromDate = DateService.subtractDays(today, Math.floor(days * 1.5));

    const fromDateStr = DateService.formatDate(fromDate);
    const toDateStr = DateService.formatDate(today);

    await this.execute({ fromDate: fromDateStr, toDate: toDateStr });
  }

  async computeToday(): Promise<void> {
    const today = DateService.formatDate(new Date());
    await this.execute({ fromDate: today, toDate: today });
  }
}
