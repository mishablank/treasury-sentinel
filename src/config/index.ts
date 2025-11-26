/**
 * Configuration Module Exports
 */

export * from './env';
export * from './database';
export * from './scheduler';
export * from './chains';
export * from './budget';
export * from './payments';

// Re-export commonly used configs
import { env } from './env';
import { databaseConfig, createDatabaseConnection } from './database';
import { schedulerConfig, createJobSchedule } from './scheduler';
import { SUPPORTED_CHAINS, getChainConfig, getChainRpcUrl } from './chains';
import { budgetConfig, createBudgetConfig, calculateThresholds } from './budget';
import { paymentConfig, http402Config, createPaymentRequest } from './payments';

export const config = {
  env,
  database: databaseConfig,
  scheduler: schedulerConfig,
  chains: SUPPORTED_CHAINS,
  budget: budgetConfig,
  payment: paymentConfig,
  http402: http402Config,
} as const;

export type Config = typeof config;
