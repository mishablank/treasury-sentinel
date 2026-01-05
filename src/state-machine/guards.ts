import { EscalationLevel, EscalationContext, GuardCondition } from '../types/escalation';
import { BudgetConfig, BUDGET_LIMITS } from '../config/budget';

export interface GuardResult {
  allowed: boolean;
  reason: string;
  blockedBy?: string;
}

export function checkBudgetAvailable(context: EscalationContext): GuardResult {
  const { totalSpent, budgetLimit } = context;
  const remaining = budgetLimit - totalSpent;
  
  // Fix: Use strict comparison to prevent floating point issues
  const isAvailable = remaining >= 0.01; // Minimum viable payment threshold
  
  return {
    allowed: isAvailable,
    reason: isAvailable 
      ? `Budget available: ${remaining.toFixed(2)} USDC remaining`
      : `Budget exhausted: ${totalSpent.toFixed(2)} / ${budgetLimit.toFixed(2)} USDC spent`,
    blockedBy: isAvailable ? undefined : 'BUDGET_LIMIT'
  };
}

export function checkEscalationThreshold(
  currentLevel: EscalationLevel,
  targetLevel: EscalationLevel,
  context: EscalationContext
): GuardResult {
  // Fix: Validate level transition is sequential (no skipping levels)
  const levelOrder: EscalationLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
  const currentIndex = levelOrder.indexOf(currentLevel);
  const targetIndex = levelOrder.indexOf(targetLevel);
  
  // Allow same level (no-op) or single step transitions
  const isSequential = targetIndex <= currentIndex + 1;
  
  if (!isSequential) {
    return {
      allowed: false,
      reason: `Cannot skip levels: ${currentLevel} -> ${targetLevel}`,
      blockedBy: 'LEVEL_SKIP_VIOLATION'
    };
  }
  
  // Check if risk score warrants escalation
  const riskThresholds: Record<EscalationLevel, number> = {
    'L0': 0,
    'L1': 0.2,
    'L2': 0.4,
    'L3': 0.6,
    'L4': 0.8,
    'L5': 0.95
  };
  
  const requiredRisk = riskThresholds[targetLevel];
  const meetsThreshold = context.riskScore >= requiredRisk;
  
  return {
    allowed: meetsThreshold,
    reason: meetsThreshold
      ? `Risk score ${context.riskScore.toFixed(2)} meets ${targetLevel} threshold (${requiredRisk})`
      : `Risk score ${context.riskScore.toFixed(2)} below ${targetLevel} threshold (${requiredRisk})`,
    blockedBy: meetsThreshold ? undefined : 'RISK_THRESHOLD'
  };
}

export function checkCooldownPeriod(context: EscalationContext): GuardResult {
  const { lastEscalationTime, cooldownMs } = context;
  
  if (!lastEscalationTime) {
    return { allowed: true, reason: 'No previous escalation' };
  }
  
  const elapsed = Date.now() - lastEscalationTime;
  const remaining = cooldownMs - elapsed;
  
  // Fix: Ensure cooldown is properly enforced with buffer
  const cooldownComplete = remaining <= 0;
  
  return {
    allowed: cooldownComplete,
    reason: cooldownComplete
      ? 'Cooldown period complete'
      : `Cooldown active: ${Math.ceil(remaining / 1000)}s remaining`,
    blockedBy: cooldownComplete ? undefined : 'COOLDOWN_ACTIVE'
  };
}

export function checkPaymentVerification(context: EscalationContext): GuardResult {
  const { pendingPayment, lastPaymentVerified } = context;
  
  // Fix: Block escalation if there's an unverified pending payment
  if (pendingPayment && !lastPaymentVerified) {
    return {
      allowed: false,
      reason: `Pending payment of ${pendingPayment.amount} USDC awaiting verification`,
      blockedBy: 'PAYMENT_PENDING'
    };
  }
  
  return {
    allowed: true,
    reason: 'No pending payments blocking escalation'
  };
}

export function evaluateAllGuards(
  currentLevel: EscalationLevel,
  targetLevel: EscalationLevel,
  context: EscalationContext
): GuardResult {
  // Check guards in priority order
  const guards = [
    () => checkBudgetAvailable(context),
    () => checkPaymentVerification(context),
    () => checkCooldownPeriod(context),
    () => checkEscalationThreshold(currentLevel, targetLevel, context)
  ];
  
  for (const guard of guards) {
    const result = guard();
    if (!result.allowed) {
      return result;
    }
  }
  
  return {
    allowed: true,
    reason: `All guards passed for ${currentLevel} -> ${targetLevel} transition`
  };
}

export function shouldBlockBudget(context: EscalationContext): boolean {
  // Fix: Properly determine if we should transition to BUDGET_BLOCKED
  const result = checkBudgetAvailable(context);
  return !result.allowed && result.blockedBy === 'BUDGET_LIMIT';
}

export function getGuardConditions(
  currentLevel: EscalationLevel,
  targetLevel: EscalationLevel
): GuardCondition[] {
  return [
    {
      id: 'budget',
      name: 'Budget Available',
      description: 'Sufficient USDC budget remaining'
    },
    {
      id: 'payment',
      name: 'Payment Verified',
      description: 'No pending unverified payments'
    },
    {
      id: 'cooldown',
      name: 'Cooldown Complete',
      description: 'Minimum time between escalations'
    },
    {
      id: 'threshold',
      name: 'Risk Threshold',
      description: `Risk score meets ${targetLevel} requirements`
    }
  ];
}