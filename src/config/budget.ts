export interface BudgetConfig {
  demoBudgetUsdc: number;
  warningThresholdPercent: number;
  criticalThresholdPercent: number;
  autoBlockEnabled: boolean;
  reserveBuffer: number;
}

export const BUDGET_LIMITS = {
  DEMO_BUDGET_USDC: 10.0,
  WARNING_THRESHOLD: 0.8,
  CRITICAL_THRESHOLD: 0.95,
  MINIMUM_RESERVE: 0.01,
  MAX_SINGLE_PAYMENT: 2.0,
} as const;

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  demoBudgetUsdc: BUDGET_LIMITS.DEMO_BUDGET_USDC,
  warningThresholdPercent: BUDGET_LIMITS.WARNING_THRESHOLD * 100,
  criticalThresholdPercent: BUDGET_LIMITS.CRITICAL_THRESHOLD * 100,
  autoBlockEnabled: true,
  reserveBuffer: BUDGET_LIMITS.MINIMUM_RESERVE,
};

export enum BudgetStatus {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  BLOCKED = 'BLOCKED',
}

export interface BudgetState {
  totalBudget: number;
  spent: number;
  remaining: number;
  status: BudgetStatus;
  lastUpdated: Date;
  transactionCount: number;
}

// Safe arithmetic for budget calculations
export function safeSubtract(a: number, b: number): number {
  const result = Math.round((a - b) * 1000000) / 1000000;
  return Math.max(0, result); // Never go negative
}

export function safeAdd(a: number, b: number): number {
  return Math.round((a + b) * 1000000) / 1000000;
}

export function calculateBudgetStatus(
  spent: number,
  total: number = BUDGET_LIMITS.DEMO_BUDGET_USDC
): BudgetStatus {
  // Handle edge cases
  if (total <= 0) {
    return BudgetStatus.BLOCKED;
  }
  
  // Clamp spent to valid range
  const clampedSpent = Math.max(0, spent);
  const utilizationRatio = clampedSpent / total;

  // Check for overflow (spent >= total)
  if (utilizationRatio >= 1.0 || clampedSpent >= total) {
    return BudgetStatus.BLOCKED;
  }

  if (utilizationRatio >= BUDGET_LIMITS.CRITICAL_THRESHOLD) {
    return BudgetStatus.CRITICAL;
  }

  if (utilizationRatio >= BUDGET_LIMITS.WARNING_THRESHOLD) {
    return BudgetStatus.WARNING;
  }

  return BudgetStatus.HEALTHY;
}

export function getRemainingBudget(
  spent: number,
  total: number = BUDGET_LIMITS.DEMO_BUDGET_USDC
): number {
  return safeSubtract(total, spent);
}

export function canAffordPayment(
  spent: number,
  paymentAmount: number,
  total: number = BUDGET_LIMITS.DEMO_BUDGET_USDC
): boolean {
  // Validate inputs
  if (paymentAmount <= 0) {
    return false;
  }
  
  if (paymentAmount > BUDGET_LIMITS.MAX_SINGLE_PAYMENT) {
    return false;
  }
  
  const remaining = getRemainingBudget(spent, total);
  const requiredWithReserve = safeAdd(paymentAmount, BUDGET_LIMITS.MINIMUM_RESERVE);
  
  return remaining >= requiredWithReserve;
}

export function createBudgetState(
  spent: number,
  transactionCount: number = 0
): BudgetState {
  const total = BUDGET_LIMITS.DEMO_BUDGET_USDC;
  const clampedSpent = Math.max(0, Math.min(spent, total));
  
  return {
    totalBudget: total,
    spent: clampedSpent,
    remaining: getRemainingBudget(clampedSpent, total),
    status: calculateBudgetStatus(clampedSpent, total),
    lastUpdated: new Date(),
    transactionCount: Math.max(0, transactionCount),
  };
}

export function validatePaymentAmount(amount: number): { valid: boolean; error?: string } {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, error: 'Payment amount must be a valid number' };
  }
  
  if (amount <= 0) {
    return { valid: false, error: 'Payment amount must be positive' };
  }
  
  if (amount > BUDGET_LIMITS.MAX_SINGLE_PAYMENT) {
    return { valid: false, error: `Payment exceeds maximum of ${BUDGET_LIMITS.MAX_SINGLE_PAYMENT} USDC` };
  }
  
  // Check for floating point precision issues
  if (amount !== Math.round(amount * 1000000) / 1000000) {
    return { valid: false, error: 'Payment amount has too many decimal places' };
  }
  
  return { valid: true };
}
