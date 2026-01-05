import { EscalationState, EscalationTransition, EscalationEvent, EscalationContext } from '../types/escalation';
import { evaluateAllGuards, shouldBlockBudget, GuardResult } from './guards';

export const STATE_TRANSITIONS: EscalationTransition[] = [
  // From IDLE
  { from: 'IDLE', to: 'MONITORING', event: 'RISK_UPDATE', guards: ['budget'] },
  
  // From MONITORING
  { from: 'MONITORING', to: 'ESCALATING', event: 'ESCALATE', guards: ['budget', 'threshold', 'cooldown'] },
  { from: 'MONITORING', to: 'BUDGET_BLOCKED', event: 'BUDGET_EXHAUSTED' },
  { from: 'MONITORING', to: 'IDLE', event: 'DE_ESCALATE' },
  
  // From ESCALATING
  { from: 'ESCALATING', to: 'AWAITING_PAYMENT', event: 'PAYMENT_REQUIRED' },
  { from: 'ESCALATING', to: 'MONITORING', event: 'ESCALATE', actions: ['updateLevel'] },
  { from: 'ESCALATING', to: 'BUDGET_BLOCKED', event: 'BUDGET_EXHAUSTED' },
  
  // From AWAITING_PAYMENT
  { from: 'AWAITING_PAYMENT', to: 'PAYMENT_PENDING', event: 'PAYMENT_REQUIRED', actions: ['initiatePayment'] },
  { from: 'AWAITING_PAYMENT', to: 'BUDGET_BLOCKED', event: 'BUDGET_EXHAUSTED' },
  
  // From PAYMENT_PENDING
  { from: 'PAYMENT_PENDING', to: 'COOLDOWN', event: 'PAYMENT_CONFIRMED', actions: ['recordPayment'] },
  { from: 'PAYMENT_PENDING', to: 'MONITORING', event: 'PAYMENT_FAILED' },
  { from: 'PAYMENT_PENDING', to: 'BUDGET_BLOCKED', event: 'BUDGET_EXHAUSTED' },
  
  // From COOLDOWN
  { from: 'COOLDOWN', to: 'MONITORING', event: 'COOLDOWN_COMPLETE' },
  { from: 'COOLDOWN', to: 'BUDGET_BLOCKED', event: 'BUDGET_EXHAUSTED' },
  
  // From BUDGET_BLOCKED (limited transitions)
  { from: 'BUDGET_BLOCKED', to: 'MONITORING', event: 'RISK_UPDATE', guards: ['budget'] }
];

export interface TransitionResult {
  success: boolean;
  newState: EscalationState;
  guardResult?: GuardResult;
  actionsExecuted?: string[];
}

export function findValidTransition(
  currentState: EscalationState,
  event: EscalationEvent['type']
): EscalationTransition | undefined {
  return STATE_TRANSITIONS.find(
    t => t.from === currentState && t.event === event
  );
}

export function canTransition(
  currentState: EscalationState,
  event: EscalationEvent['type'],
  context: EscalationContext
): TransitionResult {
  const transition = findValidTransition(currentState, event);
  
  if (!transition) {
    return {
      success: false,
      newState: currentState,
      guardResult: {
        allowed: false,
        reason: `No valid transition from ${currentState} on event ${event}`,
        blockedBy: 'INVALID_TRANSITION'
      }
    };
  }
  
  // Fix: Always check for budget exhaustion first
  if (shouldBlockBudget(context) && transition.to !== 'BUDGET_BLOCKED') {
    return {
      success: false,
      newState: currentState,
      guardResult: {
        allowed: false,
        reason: 'Budget exhausted - must transition to BUDGET_BLOCKED',
        blockedBy: 'BUDGET_LIMIT'
      }
    };
  }
  
  // Evaluate guards if present
  if (transition.guards && transition.guards.length > 0) {
    const guardResult = evaluateAllGuards(
      context.currentLevel,
      context.currentLevel, // For non-escalation transitions
      context
    );
    
    if (!guardResult.allowed) {
      return {
        success: false,
        newState: currentState,
        guardResult
      };
    }
  }
  
  return {
    success: true,
    newState: transition.to,
    actionsExecuted: transition.actions
  };
}

export function getAvailableTransitions(
  currentState: EscalationState
): EscalationTransition[] {
  return STATE_TRANSITIONS.filter(t => t.from === currentState);
}

export function getStateDescription(state: EscalationState): string {
  const descriptions: Record<EscalationState, string> = {
    'IDLE': 'System idle, no active monitoring',
    'MONITORING': 'Actively monitoring treasury positions',
    'ESCALATING': 'Processing escalation to higher data tier',
    'AWAITING_PAYMENT': 'HTTP 402 received, payment required',
    'PAYMENT_PENDING': 'Payment submitted, awaiting confirmation',
    'BUDGET_BLOCKED': 'Demo budget exhausted (10 USDC limit)',
    'COOLDOWN': 'Post-payment cooldown period active'
  };
  
  return descriptions[state];
}