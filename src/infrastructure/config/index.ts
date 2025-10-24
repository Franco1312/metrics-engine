import type { EnvironmentConfig } from '@/infrastructure/config/types.js';
import { localConfig } from '@/infrastructure/config/environments/local.js';
import { stagingConfig } from '@/infrastructure/config/environments/staging.js';
import { productionConfig } from '@/infrastructure/config/environments/production.js';

export function getConfig(): EnvironmentConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (nodeEnv === 'production') {
    return productionConfig;
  }

  if (nodeEnv === 'staging') {
    return stagingConfig;
  }

  return localConfig;
}

export const config = getConfig();
