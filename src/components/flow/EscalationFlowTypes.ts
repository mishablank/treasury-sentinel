import { Node, Edge, MarkerType } from 'reactflow';
import { EscalationLevel, EscalationState, GuardCondition } from '../../types/escalation';

export interface EscalationNodeData {
  level: EscalationLevel;
  label: string;
  description: string;
  isActive: boolean;
  isBlocked: boolean;
  enteredAt?: Date;
  metrics?: {
    lcr?: number;
    volatilityRegime?: string;
    budgetRemaining?: number;
  };
}

export interface EscalationEdgeData {
  guard: GuardCondition;
  guardLabel: string;
  transitionCount: number;
  lastTransition?: Date;
}

export type EscalationNode = Node<EscalationNodeData>;
export type EscalationEdge = Edge<EscalationEdgeData>;

export interface FlowConfig {
  nodeSpacing: {
    horizontal: number;
    vertical: number;
  };
  colors: {
    active: string;
    inactive: string;
    blocked: string;
    edge: string;
    edgeActive: string;
  };
}

export const DEFAULT_FLOW_CONFIG: FlowConfig = {
  nodeSpacing: {
    horizontal: 250,
    vertical: 100,
  },
  colors: {
    active: '#22c55e',
    inactive: '#6b7280',
    blocked: '#ef4444',
    edge: '#9ca3af',
    edgeActive: '#3b82f6',
  },
};

export const LEVEL_DESCRIPTIONS: Record<EscalationLevel, string> = {
  [EscalationLevel.L0_IDLE]: 'System idle, no active monitoring',
  [EscalationLevel.L1_PASSIVE]: 'Passive monitoring with cached data',
  [EscalationLevel.L2_ACTIVE]: 'Active monitoring with basic API calls',
  [EscalationLevel.L3_ELEVATED]: 'Elevated monitoring with frequent updates',
  [EscalationLevel.L4_CRITICAL]: 'Critical monitoring with real-time data',
  [EscalationLevel.L5_EMERGENCY]: 'Emergency mode with maximum data access',
};

export const GUARD_LABELS: Record<GuardCondition, string> = {
  [GuardCondition.LCR_BELOW_THRESHOLD]: 'LCR < threshold',
  [GuardCondition.VOLATILITY_SPIKE]: 'Volatility spike detected',
  [GuardCondition.BUDGET_AVAILABLE]: 'Budget available',
  [GuardCondition.BUDGET_EXHAUSTED]: 'Budget exhausted',
  [GuardCondition.TIME_ELAPSED]: 'Time elapsed',
  [GuardCondition.MANUAL_OVERRIDE]: 'Manual override',
  [GuardCondition.LIQUIDITY_CRISIS]: 'Liquidity crisis',
  [GuardCondition.MARKET_HOURS]: 'Within market hours',
  [GuardCondition.COOLDOWN_EXPIRED]: 'Cooldown expired',
};

export function createNodeId(level: EscalationLevel): string {
  return `node-${level}`;
}

export function createEdgeId(from: EscalationLevel, to: EscalationLevel): string {
  return `edge-${from}-${to}`;
}
