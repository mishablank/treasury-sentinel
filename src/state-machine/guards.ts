import { EscalationLevel, EscalationContext, EscalationGuard } from '../types/escalation';
import { BudgetState } from '../config/budget';

export interface GuardCondition {
  name: string;
  description: string;
  evaluate: (context: EscalationContext) => boolean;
}

export const guardConditions: Record<string, GuardCondition> = {
  hasAnomalyDetected: {
    name: 'Anomaly Detected',
    description: 'Treasury balance anomaly detected',
    evaluate: (ctx) => ctx.anomalyDetected === true,
  },
  hasSufficientBudget: {
    name: 'Budget Available',
    description: 'Sufficient budget for data request',
    evaluate: (ctx) => {
      const blocked = ctx.budgetState === 'BUDGET_BLOCKED';
      const critical = ctx.budgetState === 'CRITICAL' && ctx.budgetRemaining < 0.5;
      return !blocked && !critical;
    },
  },
  hasVolatilitySpike: {
    name: 'Volatility Spike',
    description: 'Market volatility exceeds threshold',
    evaluate: (ctx) => (ctx.volatilityIndex ?? 0) > 0.7,
  },
  hasLiquidityCrisis: {
    name: 'Liquidity Crisis',
    description: 'LCR below critical threshold',
    evaluate: (ctx) => (ctx.lcr ?? 1) < 0.3,
  },
  canEscalate: {
    name: 'Can Escalate',
    description: 'Escalation is permitted',
    evaluate: (ctx) => {
      // Cannot escalate from blocked state
      if (ctx.budgetState === 'BUDGET_BLOCKED') {
        return false;
      }
      // Cannot escalate if at max level
      if (ctx.currentLevel >= 5) {
        return false;
      }
      return true;
    },
  },
  canDeescalate: {
    name: 'Can De-escalate',
    description: 'De-escalation is permitted',
    evaluate: (ctx) => {
      // Cannot de-escalate from L0
      if (ctx.currentLevel <= 0) {
        return false;
      }
      // Cannot de-escalate from blocked state
      if (ctx.budgetState === 'BUDGET_BLOCKED') {
        return false;
      }
      return true;
    },
  },
  isRecoveryPossible: {
    name: 'Recovery Possible',
    description: 'Conditions allow recovery from high alert',
    evaluate: (ctx) => {
      const volatilityNormal = (ctx.volatilityIndex ?? 0) < 0.5;
      const liquidityOk = (ctx.lcr ?? 1) > 0.5;
      const noAnomalies = ctx.anomalyDetected !== true;
      return volatilityNormal && liquidityOk && noAnomalies;
    },
  },
  requiresImmediateAction: {
    name: 'Immediate Action Required',
    description: 'Critical conditions require immediate escalation',
    evaluate: (ctx) => {
      const criticalLiquidity = (ctx.lcr ?? 1) < 0.2;
      const extremeVolatility = (ctx.volatilityIndex ?? 0) > 0.9;
      return criticalLiquidity || extremeVolatility;
    },
  },
};

export function createGuard(
  from: EscalationLevel,
  to: EscalationLevel,
  conditions: string[]
): EscalationGuard {
  return {
    from,
    to,
    conditions,
    evaluate: (context: EscalationContext) => {
      // Validate state transition is valid
      const levelDiff = to - from;
      
      // Special case: transition to/from blocked state
      if (context.budgetState === 'BUDGET_BLOCKED') {
        // Only allow staying in current state or specific recovery transitions
        if (from !== to && to !== from) {
          return false;
        }
      }

      // Normal transitions should be +/- 1 level (or same)
      if (Math.abs(levelDiff) > 1 && to !== from) {
        // Exception: immediate action can skip levels
        if (!guardConditions.requiresImmediateAction.evaluate(context)) {
          return false;
        }
      }

      // Evaluate all conditions
      return conditions.every((conditionName) => {
        const condition = guardConditions[conditionName];
        if (!condition) {
          console.warn(`Unknown guard condition: ${conditionName}`);
          return true; // Unknown conditions pass by default
        }
        return condition.evaluate(context);
      });
    },
  };
}

export function validateTransition(
  from: EscalationLevel,
  to: EscalationLevel,
  context: EscalationContext
): { valid: boolean; reason?: string } {
  // Same level is always valid
  if (from === to) {
    return { valid: true };
  }

  // Check budget blocking
  if (context.budgetState === 'BUDGET_BLOCKED') {
    return {
      valid: false,
      reason: 'Budget blocked - no state transitions allowed',
    };
  }

  // Check escalation
  if (to > from) {
    if (!guardConditions.canEscalate.evaluate(context)) {
      return {
        valid: false,
        reason: 'Escalation conditions not met',
      };
    }
  }

  // Check de-escalation
  if (to < from) {
    if (!guardConditions.canDeescalate.evaluate(context)) {
      return {
        valid: false,
        reason: 'De-escalation conditions not met',
      };
    }
  }

  return { valid: true };
}

export const defaultGuards: EscalationGuard[] = [
  createGuard(0, 1, ['hasAnomalyDetected', 'hasSufficientBudget', 'canEscalate']),
  createGuard(1, 2, ['hasVolatilitySpike', 'hasSufficientBudget', 'canEscalate']),
  createGuard(2, 3, ['hasLiquidityCrisis', 'hasSufficientBudget', 'canEscalate']),
  createGuard(3, 4, ['hasLiquidityCrisis', 'hasVolatilitySpike', 'hasSufficientBudget', 'canEscalate']),
  createGuard(4, 5, ['requiresImmediateAction', 'hasSufficientBudget', 'canEscalate']),
  createGuard(5, 4, ['isRecoveryPossible', 'canDeescalate']),
  createGuard(4, 3, ['isRecoveryPossible', 'canDeescalate']),
  createGuard(3, 2, ['isRecoveryPossible', 'canDeescalate']),
  createGuard(2, 1, ['isRecoveryPossible', 'canDeescalate']),
  createGuard(1, 0, ['isRecoveryPossible', 'canDeescalate']),
];
