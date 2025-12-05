import { EscalationLevel } from '../types/escalation';

export interface StateConfig {
  level: EscalationLevel;
  name: string;
  description: string;
  color: string;
  autoTransitionTimeout?: number; // ms before auto-escalation
  requiredConfirmations?: number;
}

export interface TransitionConfig {
  from: EscalationLevel;
  to: EscalationLevel;
  guard: string;
  label: string;
  cost?: number; // USDC cost for this transition
  requiresPayment: boolean;
}

export const STATE_CONFIGS: Record<EscalationLevel, StateConfig> = {
  [EscalationLevel.L0_IDLE]: {
    level: EscalationLevel.L0_IDLE,
    name: 'Idle',
    description: 'Normal operation, no active monitoring',
    color: '#6b7280',
    autoTransitionTimeout: undefined,
  },
  [EscalationLevel.L1_MONITOR]: {
    level: EscalationLevel.L1_MONITOR,
    name: 'Monitor',
    description: 'Active monitoring with standard polling',
    color: '#22c55e',
    autoTransitionTimeout: 900000, // 15 minutes
  },
  [EscalationLevel.L2_ALERT]: {
    level: EscalationLevel.L2_ALERT,
    name: 'Alert',
    description: 'Elevated risk detected, increased polling frequency',
    color: '#eab308',
    autoTransitionTimeout: 300000, // 5 minutes
  },
  [EscalationLevel.L3_MARKET_DATA]: {
    level: EscalationLevel.L3_MARKET_DATA,
    name: 'Market Data',
    description: 'Fetching real-time market data via Kaiko (paid)',
    color: '#f97316',
    autoTransitionTimeout: 180000, // 3 minutes
    requiredConfirmations: 1,
  },
  [EscalationLevel.L4_CRITICAL]: {
    level: EscalationLevel.L4_CRITICAL,
    name: 'Critical',
    description: 'Critical risk level, immediate action required',
    color: '#ef4444',
    autoTransitionTimeout: 60000, // 1 minute
    requiredConfirmations: 2,
  },
  [EscalationLevel.L5_EMERGENCY]: {
    level: EscalationLevel.L5_EMERGENCY,
    name: 'Emergency',
    description: 'Emergency state, all hands on deck',
    color: '#dc2626',
    autoTransitionTimeout: undefined,
    requiredConfirmations: 3,
  },
  [EscalationLevel.BUDGET_BLOCKED]: {
    level: EscalationLevel.BUDGET_BLOCKED,
    name: 'Budget Blocked',
    description: 'Budget exhausted, paid features disabled',
    color: '#7c3aed',
    autoTransitionTimeout: undefined,
  },
};

export const TRANSITION_CONFIGS: TransitionConfig[] = [
  // Forward escalations
  {
    from: EscalationLevel.L0_IDLE,
    to: EscalationLevel.L1_MONITOR,
    guard: 'canStartMonitoring',
    label: 'Start Monitoring',
    requiresPayment: false,
  },
  {
    from: EscalationLevel.L1_MONITOR,
    to: EscalationLevel.L2_ALERT,
    guard: 'shouldEscalateToAlert',
    label: 'Risk Threshold Exceeded',
    requiresPayment: false,
  },
  {
    from: EscalationLevel.L2_ALERT,
    to: EscalationLevel.L3_MARKET_DATA,
    guard: 'shouldEscalateToMarketData',
    label: 'Fetch Market Data',
    cost: 0.5,
    requiresPayment: true,
  },
  {
    from: EscalationLevel.L3_MARKET_DATA,
    to: EscalationLevel.L4_CRITICAL,
    guard: 'shouldEscalateToCritical',
    label: 'Critical Threshold',
    cost: 1.0,
    requiresPayment: true,
  },
  {
    from: EscalationLevel.L4_CRITICAL,
    to: EscalationLevel.L5_EMERGENCY,
    guard: 'shouldEscalateToEmergency',
    label: 'Emergency Protocol',
    cost: 2.0,
    requiresPayment: true,
  },
  // De-escalations
  {
    from: EscalationLevel.L5_EMERGENCY,
    to: EscalationLevel.L4_CRITICAL,
    guard: 'canDeescalateFromEmergency',
    label: 'Stabilizing',
    requiresPayment: false,
  },
  {
    from: EscalationLevel.L4_CRITICAL,
    to: EscalationLevel.L3_MARKET_DATA,
    guard: 'canDeescalateFromCritical',
    label: 'Risk Decreasing',
    requiresPayment: false,
  },
  {
    from: EscalationLevel.L3_MARKET_DATA,
    to: EscalationLevel.L2_ALERT,
    guard: 'canDeescalateFromMarketData',
    label: 'Market Stable',
    requiresPayment: false,
  },
  {
    from: EscalationLevel.L2_ALERT,
    to: EscalationLevel.L1_MONITOR,
    guard: 'canDeescalateFromAlert',
    label: 'Risk Normalized',
    requiresPayment: false,
  },
  {
    from: EscalationLevel.L1_MONITOR,
    to: EscalationLevel.L0_IDLE,
    guard: 'canStopMonitoring',
    label: 'Stop Monitoring',
    requiresPayment: false,
  },
  // Budget block transitions
  {
    from: EscalationLevel.L2_ALERT,
    to: EscalationLevel.BUDGET_BLOCKED,
    guard: 'isBudgetExhausted',
    label: 'Budget Exhausted',
    requiresPayment: false,
  },
  {
    from: EscalationLevel.L3_MARKET_DATA,
    to: EscalationLevel.BUDGET_BLOCKED,
    guard: 'isBudgetExhausted',
    label: 'Budget Exhausted',
    requiresPayment: false,
  },
  {
    from: EscalationLevel.L4_CRITICAL,
    to: EscalationLevel.BUDGET_BLOCKED,
    guard: 'isBudgetExhausted',
    label: 'Budget Exhausted',
    requiresPayment: false,
  },
  {
    from: EscalationLevel.BUDGET_BLOCKED,
    to: EscalationLevel.L1_MONITOR,
    guard: 'hasBudgetRestored',
    label: 'Budget Restored',
    requiresPayment: false,
  },
];

export function getStateConfig(level: EscalationLevel): StateConfig {
  return STATE_CONFIGS[level];
}

export function getTransitionsFrom(level: EscalationLevel): TransitionConfig[] {
  return TRANSITION_CONFIGS.filter((t) => t.from === level);
}

export function getTransitionsTo(level: EscalationLevel): TransitionConfig[] {
  return TRANSITION_CONFIGS.filter((t) => t.to === level);
}

export function findTransition(
  from: EscalationLevel,
  to: EscalationLevel
): TransitionConfig | undefined {
  return TRANSITION_CONFIGS.find((t) => t.from === from && t.to === to);
}

export function getTransitionCost(
  from: EscalationLevel,
  to: EscalationLevel
): number {
  const transition = findTransition(from, to);
  return transition?.cost ?? 0;
}
