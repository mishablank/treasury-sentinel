import { EscalationLevel, EscalationContext, GuardCondition } from '../types/escalation';
import { LiquidityMetrics, VolatilityRegime } from '../types/liquidity';
import { BUDGET_CONFIG } from '../config/budget';

export interface GuardResult {
  allowed: boolean;
  reason: string;
  blockedBy?: string;
}

export class EscalationGuards {
  /**
   * Check if budget allows escalation to target level
   * Fixed: Now properly handles edge case where remaining budget equals level cost
   */
  static checkBudgetGuard(context: EscalationContext, targetLevel: EscalationLevel): GuardResult {
    const levelCosts: Record<EscalationLevel, number> = {
      [EscalationLevel.L0_IDLE]: 0,
      [EscalationLevel.L1_ALERT]: 0.1,
      [EscalationLevel.L2_MONITOR]: 0.5,
      [EscalationLevel.L3_ACTIVE]: 1.0,
      [EscalationLevel.L4_CRITICAL]: 2.0,
      [EscalationLevel.L5_EMERGENCY]: 5.0,
    };

    const requiredBudget = levelCosts[targetLevel];
    const remainingBudget = context.budgetRemaining;
    
    // Fixed: Use >= instead of > to allow escalation when budget exactly matches
    if (remainingBudget >= requiredBudget) {
      return {
        allowed: true,
        reason: `Budget sufficient: ${remainingBudget.toFixed(2)} USDC >= ${requiredBudget.toFixed(2)} USDC required`,
      };
    }

    return {
      allowed: false,
      reason: `Insufficient budget: ${remainingBudget.toFixed(2)} USDC < ${requiredBudget.toFixed(2)} USDC required`,
      blockedBy: 'BUDGET_GUARD',
    };
  }

  /**
   * Check if liquidity conditions warrant escalation
   * Fixed: Added null checks for optional metrics
   */
  static checkLiquidityGuard(
    metrics: LiquidityMetrics | null | undefined,
    targetLevel: EscalationLevel
  ): GuardResult {
    // Fixed: Handle null/undefined metrics gracefully
    if (!metrics) {
      // Allow L0-L1 without metrics, block higher levels
      if (targetLevel <= EscalationLevel.L1_ALERT) {
        return {
          allowed: true,
          reason: 'Metrics unavailable, allowing low-level escalation',
        };
      }
      return {
        allowed: false,
        reason: 'Liquidity metrics required for escalation above L1',
        blockedBy: 'METRICS_UNAVAILABLE',
      };
    }

    const thresholds: Record<EscalationLevel, { lcr: number; halfLife: number }> = {
      [EscalationLevel.L0_IDLE]: { lcr: 2.0, halfLife: 168 },
      [EscalationLevel.L1_ALERT]: { lcr: 1.5, halfLife: 72 },
      [EscalationLevel.L2_MONITOR]: { lcr: 1.2, halfLife: 24 },
      [EscalationLevel.L3_ACTIVE]: { lcr: 1.0, halfLife: 12 },
      [EscalationLevel.L4_CRITICAL]: { lcr: 0.8, halfLife: 6 },
      [EscalationLevel.L5_EMERGENCY]: { lcr: 0.5, halfLife: 2 },
    };

    const threshold = thresholds[targetLevel];
    
    // Fixed: Properly handle undefined LCR values
    const lcr = metrics.lcr ?? 999;
    const halfLife = metrics.exitHalfLife ?? 999;

    // For escalation UP, we need conditions to be worse than threshold
    // For de-escalation DOWN, we need conditions to be better than threshold
    const lcrConditionMet = lcr <= threshold.lcr;
    const halfLifeConditionMet = halfLife <= threshold.halfLife;

    if (lcrConditionMet || halfLifeConditionMet) {
      return {
        allowed: true,
        reason: `Liquidity conditions warrant ${EscalationLevel[targetLevel]}: LCR=${lcr.toFixed(2)}, HalfLife=${halfLife.toFixed(1)}h`,
      };
    }

    return {
      allowed: false,
      reason: `Liquidity conditions do not warrant escalation: LCR=${lcr.toFixed(2)} > ${threshold.lcr}, HalfLife=${halfLife.toFixed(1)}h > ${threshold.halfLife}h`,
      blockedBy: 'LIQUIDITY_GUARD',
    };
  }

  /**
   * Check if volatility regime allows escalation
   * Fixed: Handle UNKNOWN regime properly
   */
  static checkVolatilityGuard(
    regime: VolatilityRegime | null | undefined,
    targetLevel: EscalationLevel
  ): GuardResult {
    // Fixed: Treat null/undefined as UNKNOWN, not as blocking
    const effectiveRegime = regime ?? VolatilityRegime.UNKNOWN;

    const regimeMinLevel: Record<VolatilityRegime, EscalationLevel> = {
      [VolatilityRegime.LOW]: EscalationLevel.L0_IDLE,
      [VolatilityRegime.NORMAL]: EscalationLevel.L1_ALERT,
      [VolatilityRegime.ELEVATED]: EscalationLevel.L2_MONITOR,
      [VolatilityRegime.HIGH]: EscalationLevel.L3_ACTIVE,
      [VolatilityRegime.EXTREME]: EscalationLevel.L4_CRITICAL,
      [VolatilityRegime.UNKNOWN]: EscalationLevel.L1_ALERT, // Fixed: Default to L1 for unknown
    };

    const minLevel = regimeMinLevel[effectiveRegime];

    if (targetLevel >= minLevel) {
      return {
        allowed: true,
        reason: `Volatility regime ${effectiveRegime} allows ${EscalationLevel[targetLevel]}`,
      };
    }

    return {
      allowed: false,
      reason: `Volatility regime ${effectiveRegime} does not warrant ${EscalationLevel[targetLevel]} (min: ${EscalationLevel[minLevel]})`,
      blockedBy: 'VOLATILITY_GUARD',
    };
  }

  /**
   * Check cooldown period between escalations
   * Fixed: Handle first-time escalation (no lastEscalation timestamp)
   */
  static checkCooldownGuard(
    lastEscalation: Date | null | undefined,
    cooldownMinutes: number = 5
  ): GuardResult {
    // Fixed: Allow if no previous escalation
    if (!lastEscalation) {
      return {
        allowed: true,
        reason: 'No previous escalation, cooldown not applicable',
      };
    }

    const now = new Date();
    const elapsedMs = now.getTime() - lastEscalation.getTime();
    const elapsedMinutes = elapsedMs / (1000 * 60);

    if (elapsedMinutes >= cooldownMinutes) {
      return {
        allowed: true,
        reason: `Cooldown elapsed: ${elapsedMinutes.toFixed(1)} >= ${cooldownMinutes} minutes`,
      };
    }

    const remainingMinutes = cooldownMinutes - elapsedMinutes;
    return {
      allowed: false,
      reason: `Cooldown active: ${remainingMinutes.toFixed(1)} minutes remaining`,
      blockedBy: 'COOLDOWN_GUARD',
    };
  }

  /**
   * Composite guard that checks all conditions
   * Fixed: Return detailed breakdown of all guard results
   */
  static checkAllGuards(
    context: EscalationContext,
    targetLevel: EscalationLevel,
    metrics?: LiquidityMetrics | null
  ): { allowed: boolean; results: GuardResult[] } {
    const results: GuardResult[] = [];

    // Budget guard - always required
    results.push(this.checkBudgetGuard(context, targetLevel));

    // Liquidity guard - required for escalation up
    if (targetLevel > context.currentLevel) {
      results.push(this.checkLiquidityGuard(metrics, targetLevel));
    }

    // Volatility guard - advisory
    if (metrics?.volatilityRegime !== undefined) {
      results.push(this.checkVolatilityGuard(metrics.volatilityRegime, targetLevel));
    }

    // Cooldown guard
    results.push(this.checkCooldownGuard(context.lastEscalation));

    // Fixed: All required guards must pass, but mark optional ones clearly
    const requiredResults = results.filter(r => r.blockedBy !== 'VOLATILITY_GUARD');
    const allowed = requiredResults.every(r => r.allowed);

    return { allowed, results };
  }
}

export const guards = EscalationGuards;
