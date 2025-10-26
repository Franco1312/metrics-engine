import 'dotenv/config';
import { config } from '@/infrastructure/config/index.js';
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
      logger.info({
        event: CLI.TODAY,
        msg: 'Starting today metrics computation',
        data: {
          nodeEnv: process.env.NODE_ENV,
          sourceDbUrl: config.sourceDatabase.url ? 'configured' : 'not configured',
          targetDbUrl: config.targetDatabase.url ? 'configured' : 'not configured',
        },
      });
      
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
