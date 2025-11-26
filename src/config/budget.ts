/**
 * Budget Configuration
 * Strict enforcement of demo budget limits with automatic blocking
 */

import { env } from './env';

export interface BudgetConfig {
  maxBudgetUSDC: number;
  warningThresholdPercent: number;
  criticalThresholdPercent: number;
  autoBlockOnExhaustion: boolean;
  resetPeriodHours: number | null;
  trackingGranularity: 'per_request' | 'per_minute' | 'per_hour';
}

export interface BudgetState {
  totalSpentUSDC: number;
  remainingUSDC: number;
  isBlocked: boolean;
  blockedAt: Date | null;
  lastResetAt: Date;
  requestCount: number;
  averageCostPerRequest: number;
}

export interface BudgetThresholds {
  warning: number;
  critical: number;
  blocked: number;
}

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  maxBudgetUSDC: 10,
  warningThresholdPercent: 70,
  criticalThresholdPercent: 90,
  autoBlockOnExhaustion: true,
  resetPeriodHours: null, // No auto-reset for demo
  trackingGranularity: 'per_request',
};

export function createBudgetConfig(overrides?: Partial<BudgetConfig>): BudgetConfig {
  const maxBudget = env.DEMO_BUDGET_USDC ?? DEFAULT_BUDGET_CONFIG.maxBudgetUSDC;
  
  return {
    ...DEFAULT_BUDGET_CONFIG,
    maxBudgetUSDC: maxBudget,
    ...overrides,
  };
}

export function calculateThresholds(config: BudgetConfig): BudgetThresholds {
  return {
    warning: config.maxBudgetUSDC * (config.warningThresholdPercent / 100),
    critical: config.maxBudgetUSDC * (config.criticalThresholdPercent / 100),
    blocked: config.maxBudgetUSDC,
  };
}

export function initializeBudgetState(config: BudgetConfig): BudgetState {
  return {
    totalSpentUSDC: 0,
    remainingUSDC: config.maxBudgetUSDC,
    isBlocked: false,
    blockedAt: null,
    lastResetAt: new Date(),
    requestCount: 0,
    averageCostPerRequest: 0,
  };
}

export function canAffordRequest(
  state: BudgetState,
  estimatedCostUSDC: number,
  config: BudgetConfig
): { canAfford: boolean; reason?: string } {
  if (state.isBlocked) {
    return {
      canAfford: false,
      reason: `Budget blocked since ${state.blockedAt?.toISOString()}`,
    };
  }

  if (state.remainingUSDC < estimatedCostUSDC) {
    return {
      canAfford: false,
      reason: `Insufficient budget: ${state.remainingUSDC.toFixed(6)} USDC remaining, ${estimatedCostUSDC.toFixed(6)} USDC required`,
    };
  }

  const thresholds = calculateThresholds(config);
  const projectedSpent = state.totalSpentUSDC + estimatedCostUSDC;

  if (projectedSpent >= thresholds.blocked && config.autoBlockOnExhaustion) {
    return {
      canAfford: false,
      reason: `Request would exceed budget limit of ${config.maxBudgetUSDC} USDC`,
    };
  }

  return { canAfford: true };
}

export function getBudgetStatus(
  state: BudgetState,
  config: BudgetConfig
): 'healthy' | 'warning' | 'critical' | 'blocked' {
  if (state.isBlocked) {
    return 'blocked';
  }

  const thresholds = calculateThresholds(config);
  const spentPercent = (state.totalSpentUSDC / config.maxBudgetUSDC) * 100;

  if (spentPercent >= config.criticalThresholdPercent) {
    return 'critical';
  }

  if (spentPercent >= config.warningThresholdPercent) {
    return 'warning';
  }

  return 'healthy';
}

export function estimateRemainingRequests(
  state: BudgetState,
  config: BudgetConfig
): number {
  if (state.averageCostPerRequest === 0 || state.requestCount === 0) {
    // Use default Kaiko cost estimate
    const defaultCostPerRequest = 0.01; // 1 cent per request estimate
    return Math.floor(state.remainingUSDC / defaultCostPerRequest);
  }

  return Math.floor(state.remainingUSDC / state.averageCostPerRequest);
}

export const budgetConfig = createBudgetConfig();
