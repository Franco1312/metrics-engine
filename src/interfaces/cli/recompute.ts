import 'dotenv/config';
import { config } from '@/infrastructure/config/index.js';
import { Command } from 'commander';
import { DualComputeMetricsUseCase } from '@/application/usecases/computeMetrics.dual.js';
import { logger } from '@/infrastructure/log/logger.js';
import { CLI } from '@/infrastructure/log/log-events.js';

const program = new Command();

program
  .name('metrics:recompute')
  .description('Recompute metrics for a recent window')
  .option('--days <number>', 'Number of days to recompute', '30')
  .action(async options => {
    try {
      logger.info({
        event: CLI.RECOMPUTE,
        msg: 'Starting metrics recomputation',
        data: {
          nodeEnv: process.env.NODE_ENV,
          days: options.days,
        },
      });

      const useCase = new DualComputeMetricsUseCase();
      await useCase.recomputeRecentWindow(parseInt(options.days, 10));
      process.exit(0);
    } catch (error) {
      logger.error({
        event: CLI.ERROR,
        msg: 'Metrics recomputation failed',
        err: error as Error,
      });
      process.exit(1);
    }
  });

if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}
