/**
 * Treasury Sentinel
 * A DAO CFO risk console with self-funding HTTP 402 micropayments for market data escalation
 * 
 * @packageDocumentation
 */

// Core Types
export * from './types';

// Configuration
export * from './config';

// Services
export * from './services';

// State Machine
export * from './state-machine';

// Database Repositories
export * from './db/repositories';

// Events
export * from './events';

// Utilities
export * from './utils';

// React Hooks
export * from './hooks';

// Export Utilities
export * from './export/mermaid';

// Version
export const VERSION = '1.0.0';

// Application Info
export const APP_INFO = {
  name: 'Treasury Sentinel',
  version: VERSION,
  description: 'DAO CFO risk console with HTTP 402 micropayments',
  features: [
    'Multi-chain EVM treasury monitoring',
    'HTTP 402 payment-required enforcement',
    'Explicit state machine escalation ladder',
    'Real liquidity risk metrics',
    'Cron-based agent runs with persistence',
    'React dashboard with visualizations',
    'Strict budget enforcement'
  ],
  supportedChains: ['ethereum', 'gnosis', 'arbitrum', 'optimism', 'base'],
  escalationLevels: ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'],
  maxBudget: 10, // USDC
} as const;

// Quick start factory
import { ServiceContainer } from './services/container';

export function createTreasurySentinel(): ServiceContainer {
  return ServiceContainer.getInstance();
}

export default createTreasurySentinel;
