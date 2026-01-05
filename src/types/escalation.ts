export type EscalationLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export type EscalationState = 
  | 'IDLE'
  | 'MONITORING'
  | 'ESCALATING'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_PENDING'
  | 'BUDGET_BLOCKED'
  | 'COOLDOWN';

export interface PendingPayment {
  amount: number;
  currency: string;
  requestedAt: number;
  txHash?: string;
}

export interface EscalationContext {
  currentLevel: EscalationLevel;
  riskScore: number;
  totalSpent: number;
  budgetLimit: number;
  lastEscalationTime?: number;
  cooldownMs: number;
  pendingPayment?: PendingPayment;
  lastPaymentVerified: boolean;
  chainId?: number;
  treasuryAddress?: string;
}

export interface EscalationEvent {
  type: 'ESCALATE' | 'DE_ESCALATE' | 'PAYMENT_REQUIRED' | 'PAYMENT_CONFIRMED' | 'PAYMENT_FAILED' | 'BUDGET_EXHAUSTED' | 'COOLDOWN_COMPLETE' | 'RISK_UPDATE';
  payload?: {
    targetLevel?: EscalationLevel;
    amount?: number;
    txHash?: string;
    riskScore?: number;
    reason?: string;
  };
  timestamp: number;
}

export interface EscalationTransition {
  from: EscalationState;
  to: EscalationState;
  event: EscalationEvent['type'];
  guards?: string[];
  actions?: string[];
}

export interface GuardCondition {
  id: string;
  name: string;
  description: string;
}

export interface EscalationSnapshot {
  id: string;
  timestamp: number;
  state: EscalationState;
  level: EscalationLevel;
  context: EscalationContext;
  lastEvent?: EscalationEvent;
}

export interface LevelConfig {
  level: EscalationLevel;
  name: string;
  description: string;
  riskThreshold: number;
  estimatedCost: number;
  dataFeatures: string[];
  cooldownMs: number;
}

export const LEVEL_CONFIGS: Record<EscalationLevel, LevelConfig> = {
  'L0': {
    level: 'L0',
    name: 'Basic Monitoring',
    description: 'On-chain balance snapshots only',
    riskThreshold: 0,
    estimatedCost: 0,
    dataFeatures: ['Balance snapshots', 'Token holdings'],
    cooldownMs: 0
  },
  'L1': {
    level: 'L1',
    name: 'Price Feeds',
    description: 'Add spot price data',
    riskThreshold: 0.2,
    estimatedCost: 0.5,
    dataFeatures: ['Spot prices', 'Portfolio valuation'],
    cooldownMs: 60000
  },
  'L2': {
    level: 'L2',
    name: 'Volatility Regime',
    description: 'Add volatility indicators',
    riskThreshold: 0.4,
    estimatedCost: 1.0,
    dataFeatures: ['Volatility metrics', 'Regime detection'],
    cooldownMs: 120000
  },
  'L3': {
    level: 'L3',
    name: 'Depth Analysis',
    description: 'Add order book depth data',
    riskThreshold: 0.6,
    estimatedCost: 2.0,
    dataFeatures: ['Depth bands', 'Bid-ask analysis'],
    cooldownMs: 180000
  },
  'L4': {
    level: 'L4',
    name: 'Impact Curves',
    description: 'Add market impact modeling',
    riskThreshold: 0.8,
    estimatedCost: 3.0,
    dataFeatures: ['Impact curves', 'Slippage estimation'],
    cooldownMs: 300000
  },
  'L5': {
    level: 'L5',
    name: 'Full Suite',
    description: 'Complete liquidity risk analysis',
    riskThreshold: 0.95,
    estimatedCost: 4.0,
    dataFeatures: ['LCR calculation', 'Exit half-life', 'Full risk metrics'],
    cooldownMs: 600000
  }
};