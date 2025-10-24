import { DualDatabaseMetricsEngine } from '@/domain/services/metricsEngine.dual.js';
import { SourceSeriesRepositoryImpl } from '@/infrastructure/db/seriesRepo.source.js';
import { TargetMetricsRepositoryImpl } from '@/infrastructure/db/metricsRepo.target.js';
import { logger } from '@/infrastructure/log/logger.js';
import { METRICS_COMPUTATION } from '@/infrastructure/log/log-events.js';
import { DateService } from '@/domain/utils/dateService.js';

export interface ComputeMetricsParams {
  fromDate: string;
  toDate: string;
}

export class DualComputeMetricsUseCase {
  private metricsEngine: DualDatabaseMetricsEngine;

  constructor() {
    const sourceRepo = new SourceSeriesRepositoryImpl();
    const targetRepo = new TargetMetricsRepositoryImpl();
    this.metricsEngine = new DualDatabaseMetricsEngine(sourceRepo, targetRepo);
  }

  async execute(params: ComputeMetricsParams): Promise<void> {
    const { fromDate, toDate } = params;

    logger.info({
      event: METRICS_COMPUTATION.INIT,
      msg: 'Starting dual database metrics computation',
      data: { fromDate, toDate },
    });

    try {
      const results = await this.metricsEngine.computeMetricsForRange(fromDate, toDate);

      logger.info({
        event: METRICS_COMPUTATION.FINISHED,
        msg: 'Dual database metrics computation completed',
        data: {
          computed: results.length,
          fromDate,
          toDate,
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
