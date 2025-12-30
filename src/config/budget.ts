export interface BudgetConfig {
  maxBudgetUsdc: number;
  minOperationalBudget: number;
  warningThresholdPercent: number;
  criticalThresholdPercent: number;
  autoBlockEnabled: boolean;
  reservePercent: number;
}

export const BUDGET_CONFIG: BudgetConfig = {
  // Maximum allowed budget for demo mode
  maxBudgetUsdc: 10.0,
  
  // Fixed: Minimum budget required to continue operations
  // Previously was 0.01 which caused issues with floating point comparison
  minOperationalBudget: 0.05,
  
  // Warning when budget drops below this percentage
  warningThresholdPercent: 30,
  
  // Critical alert when budget drops below this percentage
  criticalThresholdPercent: 10,
  
  // Automatically block escalations when budget exhausted
  autoBlockEnabled: true,
  
  // Reserve percentage to keep for emergency operations
  reservePercent: 5,
};

export function calculateThresholds(maxBudget: number): {
  warning: number;
  critical: number;
  reserve: number;
} {
  return {
    warning: maxBudget * (BUDGET_CONFIG.warningThresholdPercent / 100),
    critical: maxBudget * (BUDGET_CONFIG.criticalThresholdPercent / 100),
    reserve: maxBudget * (BUDGET_CONFIG.reservePercent / 100),
  };
}

export function isBudgetHealthy(remaining: number, maxBudget: number): boolean {
  const thresholds = calculateThresholds(maxBudget);
  return remaining > thresholds.warning;
}

export function getBudgetStatus(remaining: number, maxBudget: number): 'healthy' | 'warning' | 'critical' | 'blocked' {
  if (remaining < BUDGET_CONFIG.minOperationalBudget) {
    return 'blocked';
  }
  
  const thresholds = calculateThresholds(maxBudget);
  
  if (remaining <= thresholds.critical) {
    return 'critical';
  }
  
  if (remaining <= thresholds.warning) {
    return 'warning';
  }
  
  return 'healthy';
}
