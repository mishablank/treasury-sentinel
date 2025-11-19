/**
 * Escalation state machine type definitions
 * Implements L0-L5 risk escalation ladder
 */

export type EscalationLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export type EscalationState =
  | 'IDLE'
  | 'MONITORING'
  | 'ALERT_PENDING'
  | 'ESCALATING'
  | 'BUDGET_BLOCKED'
  | 'COOLDOWN';

export interface EscalationGuard {
  id: string;
  name: string;
  description: string;
  evaluate: (context: EscalationContext) => boolean;
}

export interface EscalationTransition {
  from: EscalationState;
  to: EscalationState;
  guards: EscalationGuard[];
  label: string;
}

export interface EscalationContext {
  currentLevel: EscalationLevel;
  currentState: EscalationState;
  budgetRemaining: number;
  budgetLimit: number;
  lastEscalationTime: Date | null;
  cooldownEndTime: Date | null;
  riskMetrics: RiskMetricsSummary;
}

export interface RiskMetricsSummary {
  lcr: number; // Liquidity Coverage Ratio
  exitHalfLife: number; // Hours to exit 50% of position
  volatilityRegime: 'low' | 'medium' | 'high' | 'extreme';
  depthScore: number; // 0-100 liquidity depth score
}

export interface EscalationEvent {
  id: string;
  timestamp: Date;
  fromLevel: EscalationLevel;
  toLevel: EscalationLevel;
  fromState: EscalationState;
  toState: EscalationState;
  trigger: string;
  context: EscalationContext;
  costIncurred: number;
}

export interface EscalationLevelConfig {
  level: EscalationLevel;
  name: string;
  description: string;
  thresholds: {
    lcrMin?: number;
    exitHalfLifeMax?: number;
    volatilityRegimes?: Array<'low' | 'medium' | 'high' | 'extreme'>;
    depthScoreMin?: number;
  };
  actions: string[];
  dataCost: number; // USDC cost for data fetch at this level
}

export const ESCALATION_LEVELS: EscalationLevelConfig[] = [
  {
    level: 'L0',
    name: 'Normal',
    description: 'Standard monitoring, no alerts',
    thresholds: { lcrMin: 150, depthScoreMin: 70 },
    actions: ['snapshot'],
    dataCost: 0,
  },
  {
    level: 'L1',
    name: 'Watch',
    description: 'Elevated monitoring frequency',
    thresholds: { lcrMin: 120, depthScoreMin: 50 },
    actions: ['snapshot', 'basic_metrics'],
    dataCost: 0.1,
  },
  {
    level: 'L2',
    name: 'Caution',
    description: 'Enhanced data collection',
    thresholds: { lcrMin: 100, volatilityRegimes: ['medium', 'high', 'extreme'] },
    actions: ['snapshot', 'basic_metrics', 'depth_analysis'],
    dataCost: 0.5,
  },
  {
    level: 'L3',
    name: 'Warning',
    description: 'Full liquidity analysis',
    thresholds: { lcrMin: 80, exitHalfLifeMax: 48 },
    actions: ['snapshot', 'basic_metrics', 'depth_analysis', 'impact_curves'],
    dataCost: 1.0,
  },
  {
    level: 'L4',
    name: 'Critical',
    description: 'Real-time monitoring activated',
    thresholds: { lcrMin: 60, exitHalfLifeMax: 24, volatilityRegimes: ['high', 'extreme'] },
    actions: ['snapshot', 'basic_metrics', 'depth_analysis', 'impact_curves', 'realtime_feed'],
    dataCost: 2.0,
  },
  {
    level: 'L5',
    name: 'Emergency',
    description: 'Maximum data resolution, all feeds active',
    thresholds: { lcrMin: 0 },
    actions: ['snapshot', 'basic_metrics', 'depth_analysis', 'impact_curves', 'realtime_feed', 'emergency_alerts'],
    dataCost: 5.0,
  },
];
