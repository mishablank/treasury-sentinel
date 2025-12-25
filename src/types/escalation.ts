export enum EscalationLevel {
  L0_IDLE = 'L0_IDLE',
  L1_MONITORING = 'L1_MONITORING',
  L2_ALERT = 'L2_ALERT',
  L3_WARNING = 'L3_WARNING',
  L4_CRITICAL = 'L4_CRITICAL',
  L5_EMERGENCY = 'L5_EMERGENCY',
}

export interface EscalationContext {
  currentLevel: EscalationLevel;
  previousLevel?: EscalationLevel;
  riskScore?: number;
  budgetSpent?: number;
  lastEscalationTime?: Date;
  lastDataUpdate?: Date;
  consecutiveAlerts?: number;
  isBlocked?: boolean;
  metadata?: Record<string, unknown>;
}

export interface StateTransition {
  from: EscalationLevel;
  to: EscalationLevel;
  trigger: string;
  guards: string[];
  timestamp: Date;
  context: EscalationContext;
}

export interface EscalationState {
  level: EscalationLevel;
  enteredAt: Date;
  transitionCount: number;
  history: StateTransition[];
}

export interface EscalationEvent {
  type: 'ESCALATE' | 'DE_ESCALATE' | 'RESET' | 'BLOCK' | 'UNBLOCK';
  targetLevel?: EscalationLevel;
  reason?: string;
  timestamp: Date;
}

export interface GuardEvaluation {
  guardName: string;
  passed: boolean;
  reason?: string;
}

export interface TransitionResult {
  success: boolean;
  from: EscalationLevel;
  to: EscalationLevel;
  guardResults: GuardEvaluation[];
  error?: string;
  timestamp: Date;
}

export const LEVEL_ORDER: EscalationLevel[] = [
  EscalationLevel.L0_IDLE,
  EscalationLevel.L1_MONITORING,
  EscalationLevel.L2_ALERT,
  EscalationLevel.L3_WARNING,
  EscalationLevel.L4_CRITICAL,
  EscalationLevel.L5_EMERGENCY,
];

export function getLevelIndex(level: EscalationLevel): number {
  const index = LEVEL_ORDER.indexOf(level);
  if (index === -1) {
    throw new Error(`Invalid escalation level: ${level}`);
  }
  return index;
}

export function getNextLevel(current: EscalationLevel): EscalationLevel | null {
  const index = getLevelIndex(current);
  if (index >= LEVEL_ORDER.length - 1) {
    return null;
  }
  return LEVEL_ORDER[index + 1];
}

export function getPreviousLevel(current: EscalationLevel): EscalationLevel | null {
  const index = getLevelIndex(current);
  if (index <= 0) {
    return null;
  }
  return LEVEL_ORDER[index - 1];
}

export function isValidTransition(
  from: EscalationLevel,
  to: EscalationLevel
): boolean {
  const fromIndex = getLevelIndex(from);
  const toIndex = getLevelIndex(to);
  
  // Allow same level (no-op)
  if (fromIndex === toIndex) {
    return true;
  }
  
  // Allow single step in either direction
  return Math.abs(toIndex - fromIndex) === 1;
}

export function createDefaultContext(): EscalationContext {
  return {
    currentLevel: EscalationLevel.L0_IDLE,
    riskScore: 0,
    budgetSpent: 0,
    consecutiveAlerts: 0,
    isBlocked: false,
  };
}

export function validateContext(context: EscalationContext): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!context) {
    return { valid: false, errors: ['Context is null or undefined'] };
  }
  
  if (!Object.values(EscalationLevel).includes(context.currentLevel)) {
    errors.push(`Invalid current level: ${context.currentLevel}`);
  }
  
  if (context.riskScore !== undefined) {
    if (typeof context.riskScore !== 'number' || isNaN(context.riskScore)) {
      errors.push('Risk score must be a valid number');
    } else if (context.riskScore < 0 || context.riskScore > 100) {
      errors.push('Risk score must be between 0 and 100');
    }
  }
  
  if (context.budgetSpent !== undefined) {
    if (typeof context.budgetSpent !== 'number' || isNaN(context.budgetSpent)) {
      errors.push('Budget spent must be a valid number');
    } else if (context.budgetSpent < 0) {
      errors.push('Budget spent cannot be negative');
    }
  }
  
  if (context.consecutiveAlerts !== undefined) {
    if (!Number.isInteger(context.consecutiveAlerts) || context.consecutiveAlerts < 0) {
      errors.push('Consecutive alerts must be a non-negative integer');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
