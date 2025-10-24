import { Command } from 'commander';
import { DualComputeMetricsUseCase } from '@/application/usecases/computeMetrics.dual.js';
import { logger } from '@/infrastructure/log/logger.js';
import { CLI } from '@/infrastructure/log/log-events.js';

const program = new Command();

program
  .name('metrics:today')
  .description('Compute metrics for today only')
  .action(async () => {
    try {
      const useCase = new DualComputeMetricsUseCase();
      await useCase.computeToday();
      process.exit(0);
    } catch (error) {
      logger.error({
        event: CLI.ERROR,
        msg: 'Today metrics computation failed',
        err: error as Error,
      });
      process.exit(1);
    }
  });

if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}
