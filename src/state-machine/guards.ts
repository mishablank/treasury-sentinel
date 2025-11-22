import { EscalationLevel, GuardCondition } from '../types/escalation';
import { LiquidityMetrics } from '../types/treasury';

export interface RiskThresholds {
  lcr: {
    critical: number;
    warning: number;
  };
  exitHalfLife: {
    critical: number; // hours
    warning: number;
  };
  volatilityRegime: {
    high: number;
    extreme: number;
  };
}

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  lcr: {
    critical: 1.0,
    warning: 1.5,
  },
  exitHalfLife: {
    critical: 24,
    warning: 72,
  },
  volatilityRegime: {
    high: 0.5,
    extreme: 0.8,
  },
};

export function createLCRGuard(
  getCurrentMetrics: () => LiquidityMetrics | null,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): GuardCondition {
  return (_from: EscalationLevel, to: EscalationLevel): boolean => {
    const metrics = getCurrentMetrics();
    if (!metrics) return false;

    // Only allow high escalation levels if LCR warrants it
    const levelIndex = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'].indexOf(to);
    
    if (levelIndex >= 4) {
      // L4 and L5 require critical LCR
      return metrics.lcr <= thresholds.lcr.critical;
    }
    
    if (levelIndex >= 2) {
      // L2 and L3 require at least warning LCR
      return metrics.lcr <= thresholds.lcr.warning;
    }
    
    return true;
  };
}

export function createVolatilityGuard(
  getCurrentMetrics: () => LiquidityMetrics | null,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): GuardCondition {
  return (_from: EscalationLevel, to: EscalationLevel): boolean => {
    const metrics = getCurrentMetrics();
    if (!metrics) return false;

    const levelIndex = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'].indexOf(to);
    const volatilityScore = metrics.volatilityRegime === 'extreme' ? 1.0 :
                            metrics.volatilityRegime === 'high' ? 0.7 :
                            metrics.volatilityRegime === 'elevated' ? 0.4 : 0.1;
    
    // Higher escalation levels require higher volatility
    if (levelIndex >= 5) {
      return volatilityScore >= thresholds.volatilityRegime.extreme;
    }
    
    if (levelIndex >= 3) {
      return volatilityScore >= thresholds.volatilityRegime.high;
    }
    
    return true;
  };
}

export function createExitHalfLifeGuard(
  getCurrentMetrics: () => LiquidityMetrics | null,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): GuardCondition {
  return (_from: EscalationLevel, to: EscalationLevel): boolean => {
    const metrics = getCurrentMetrics();
    if (!metrics) return false;

    const levelIndex = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'].indexOf(to);
    
    if (levelIndex >= 4) {
      // L4 and L5 require critical exit half-life (very slow exit)
      return metrics.exitHalfLifeHours >= thresholds.exitHalfLife.critical * 2;
    }
    
    if (levelIndex >= 2) {
      // L2 and L3 require at least warning exit half-life
      return metrics.exitHalfLifeHours >= thresholds.exitHalfLife.warning;
    }
    
    return true;
  };
}

export function createCooldownGuard(
  getLastTransitionTime: () => Date | null,
  cooldownMinutes: number = 5
): GuardCondition {
  return (_from: EscalationLevel, _to: EscalationLevel): boolean => {
    const lastTransition = getLastTransitionTime();
    if (!lastTransition) return true;
    
    const now = new Date();
    const elapsed = (now.getTime() - lastTransition.getTime()) / 1000 / 60;
    return elapsed >= cooldownMinutes;
  };
}

export function createCompositeGuard(
  ...guards: GuardCondition[]
): GuardCondition {
  return (from: EscalationLevel, to: EscalationLevel): boolean => {
    return guards.every(guard => guard(from, to));
  };
}

export function createAnyOfGuard(
  ...guards: GuardCondition[]
): GuardCondition {
  return (from: EscalationLevel, to: EscalationLevel): boolean => {
    return guards.some(guard => guard(from, to));
  };
}
