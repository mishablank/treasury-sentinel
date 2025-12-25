import {
  EscalationLevel,
  EscalationContext,
  StateTransition,
} from '../types/escalation';
import { BudgetConfig, BUDGET_LIMITS } from '../config/budget';

export interface GuardCondition {
  name: string;
  evaluate: (context: EscalationContext) => boolean;
  description: string;
}

export interface GuardResult {
  allowed: boolean;
  failedGuards: string[];
  passedGuards: string[];
  timestamp: Date;
}

// Mutex for preventing race conditions during guard evaluation
let guardEvaluationLock = false;
const lockQueue: Array<() => void> = [];

async function acquireLock(): Promise<void> {
  return new Promise((resolve) => {
    if (!guardEvaluationLock) {
      guardEvaluationLock = true;
      resolve();
    } else {
      lockQueue.push(resolve);
    }
  });
}

function releaseLock(): void {
  const next = lockQueue.shift();
  if (next) {
    next();
  } else {
    guardEvaluationLock = false;
  }
}

// Safe numeric comparison to prevent floating point issues
function safeCompare(a: number, b: number, epsilon: number = 0.000001): number {
  const diff = a - b;
  if (Math.abs(diff) < epsilon) return 0;
  return diff > 0 ? 1 : -1;
}

export const budgetAvailableGuard: GuardCondition = {
  name: 'budget_available',
  description: 'Checks if budget is available for escalation',
  evaluate: (context: EscalationContext): boolean => {
    const spent = context.budgetSpent ?? 0;
    const limit = BUDGET_LIMITS.DEMO_BUDGET_USDC;
    
    // Use safe comparison to prevent floating point overflow issues
    if (safeCompare(spent, limit) >= 0) {
      return false;
    }
    
    // Check if we have enough for minimum escalation cost
    const remaining = limit - spent;
    const minimumCost = 0.01; // Minimum API call cost
    
    return safeCompare(remaining, minimumCost) >= 0;
  },
};

export const riskThresholdGuard: GuardCondition = {
  name: 'risk_threshold_exceeded',
  description: 'Checks if risk score exceeds threshold for level',
  evaluate: (context: EscalationContext): boolean => {
    const thresholds: Record<EscalationLevel, number> = {
      [EscalationLevel.L0_IDLE]: 0,
      [EscalationLevel.L1_MONITORING]: 20,
      [EscalationLevel.L2_ALERT]: 40,
      [EscalationLevel.L3_WARNING]: 60,
      [EscalationLevel.L4_CRITICAL]: 80,
      [EscalationLevel.L5_EMERGENCY]: 95,
    };

    const currentThreshold = thresholds[context.currentLevel];
    const riskScore = context.riskScore ?? 0;
    
    // Clamp risk score to valid range to prevent invalid state
    const clampedRisk = Math.max(0, Math.min(100, riskScore));
    
    return clampedRisk > currentThreshold;
  },
};

export const cooldownExpiredGuard: GuardCondition = {
  name: 'cooldown_expired',
  description: 'Checks if cooldown period has passed since last escalation',
  evaluate: (context: EscalationContext): boolean => {
    if (!context.lastEscalationTime) {
      return true;
    }

    const cooldownMs = 60000; // 1 minute cooldown
    const now = Date.now();
    const lastTime = context.lastEscalationTime.getTime();
    
    // Guard against invalid timestamps (future dates)
    if (lastTime > now) {
      console.warn('Invalid future timestamp detected in cooldown guard');
      return false;
    }
    
    const elapsed = now - lastTime;
    return elapsed >= cooldownMs;
  },
};

export const dataFreshnessGuard: GuardCondition = {
  name: 'data_fresh',
  description: 'Checks if market data is fresh enough for escalation decisions',
  evaluate: (context: EscalationContext): boolean => {
    if (!context.lastDataUpdate) {
      // No data yet - allow initial fetch
      return true;
    }

    const maxAgeMs = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    const dataTime = context.lastDataUpdate.getTime();
    
    // Guard against invalid timestamps
    if (dataTime > now) {
      console.warn('Invalid future data timestamp detected');
      return false;
    }
    
    const age = now - dataTime;
    return age <= maxAgeMs;
  },
};

export const notBlockedGuard: GuardCondition = {
  name: 'not_blocked',
  description: 'Checks if system is not in BUDGET_BLOCKED state',
  evaluate: (context: EscalationContext): boolean => {
    // Explicit check for blocked state
    if (context.isBlocked === true) {
      return false;
    }
    
    // Double-check budget as secondary validation
    const spent = context.budgetSpent ?? 0;
    const limit = BUDGET_LIMITS.DEMO_BUDGET_USDC;
    
    return safeCompare(spent, limit) < 0;
  },
};

export const consecutiveAlertsGuard: GuardCondition = {
  name: 'consecutive_alerts',
  description: 'Requires multiple consecutive alerts before escalation',
  evaluate: (context: EscalationContext): boolean => {
    const requiredConsecutive: Record<EscalationLevel, number> = {
      [EscalationLevel.L0_IDLE]: 1,
      [EscalationLevel.L1_MONITORING]: 1,
      [EscalationLevel.L2_ALERT]: 2,
      [EscalationLevel.L3_WARNING]: 2,
      [EscalationLevel.L4_CRITICAL]: 3,
      [EscalationLevel.L5_EMERGENCY]: 3,
    };

    const required = requiredConsecutive[context.currentLevel];
    const consecutive = context.consecutiveAlerts ?? 0;
    
    // Ensure non-negative value
    return Math.max(0, consecutive) >= required;
  },
};

export const allGuards: GuardCondition[] = [
  budgetAvailableGuard,
  riskThresholdGuard,
  cooldownExpiredGuard,
  dataFreshnessGuard,
  notBlockedGuard,
  consecutiveAlertsGuard,
];

export async function evaluateGuardsWithLock(
  guards: GuardCondition[],
  context: EscalationContext
): Promise<GuardResult> {
  await acquireLock();
  
  try {
    return evaluateGuardsSync(guards, context);
  } finally {
    releaseLock();
  }
}

function evaluateGuardsSync(
  guards: GuardCondition[],
  context: EscalationContext
): GuardResult {
  const passedGuards: string[] = [];
  const failedGuards: string[] = [];

  // Validate context before evaluation
  if (!context || typeof context.currentLevel === 'undefined') {
    return {
      allowed: false,
      failedGuards: ['invalid_context'],
      passedGuards: [],
      timestamp: new Date(),
    };
  }

  for (const guard of guards) {
    try {
      const result = guard.evaluate(context);
      if (result) {
        passedGuards.push(guard.name);
      } else {
        failedGuards.push(guard.name);
      }
    } catch (error) {
      // Guard evaluation failure should fail the guard
      console.error(`Guard ${guard.name} threw error:`, error);
      failedGuards.push(`${guard.name}_error`);
    }
  }

  return {
    allowed: failedGuards.length === 0,
    failedGuards,
    passedGuards,
    timestamp: new Date(),
  };
}

export function evaluateGuards(
  guards: GuardCondition[],
  context: EscalationContext
): GuardResult {
  return evaluateGuardsSync(guards, context);
}

export function canEscalate(context: EscalationContext): GuardResult {
  const escalationGuards = [
    budgetAvailableGuard,
    riskThresholdGuard,
    cooldownExpiredGuard,
    notBlockedGuard,
    consecutiveAlertsGuard,
  ];

  return evaluateGuards(escalationGuards, context);
}

export function canDeescalate(context: EscalationContext): GuardResult {
  const deescalationGuards = [
    cooldownExpiredGuard,
    dataFreshnessGuard,
    notBlockedGuard,
  ];

  return evaluateGuards(deescalationGuards, context);
}

export function getGuardDescriptions(): Record<string, string> {
  return allGuards.reduce((acc, guard) => {
    acc[guard.name] = guard.description;
    return acc;
  }, {} as Record<string, string>);
}
