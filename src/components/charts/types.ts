import { TreasurySnapshot, TokenBalance } from '../../types/treasury';
import { LiquidityMetricsResult, VolatilityRegime } from '../../types/liquidity';
import { PaymentRecord } from '../../types/kaiko';
import { EscalationLevel } from '../../types/escalation';

export interface ChartDataPoint {
  timestamp: number;
  date: string;
  value: number;
  label?: string;
}

export interface TreasuryChartData {
  snapshots: TreasurySnapshotDataPoint[];
  tokenBreakdown: TokenBreakdownData[];
  chainDistribution: ChainDistributionData[];
}

export interface TreasurySnapshotDataPoint {
  timestamp: number;
  date: string;
  totalValueUsd: number;
  chainId: number;
  chainName: string;
}

export interface TokenBreakdownData {
  symbol: string;
  name: string;
  valueUsd: number;
  percentage: number;
  color: string;
}

export interface ChainDistributionData {
  chainId: number;
  chainName: string;
  valueUsd: number;
  percentage: number;
  color: string;
}

export interface LiquidityChartData {
  lcrHistory: LCRDataPoint[];
  depthBands: DepthBandData[];
  impactCurve: ImpactCurveData[];
  volatilityRegimes: VolatilityRegimeData[];
}

export interface LCRDataPoint {
  timestamp: number;
  date: string;
  lcr: number;
  threshold: number;
  status: 'healthy' | 'warning' | 'critical';
}

export interface DepthBandData {
  band: string;
  bidDepth: number;
  askDepth: number;
  spread: number;
}

export interface ImpactCurveData {
  size: number;
  impact: number;
  side: 'buy' | 'sell';
}

export interface VolatilityRegimeData {
  timestamp: number;
  date: string;
  regime: VolatilityRegime;
  value: number;
}

export interface PaymentChartData {
  paymentHistory: PaymentHistoryPoint[];
  dailySpending: DailySpendingData[];
  budgetUsage: BudgetUsageData;
  endpointBreakdown: EndpointBreakdownData[];
}

export interface PaymentHistoryPoint {
  timestamp: number;
  date: string;
  amount: number;
  cumulativeAmount: number;
  endpoint: string;
  status: 'confirmed' | 'pending' | 'failed';
}

export interface DailySpendingData {
  date: string;
  amount: number;
  transactionCount: number;
}

export interface BudgetUsageData {
  totalBudget: number;
  spent: number;
  remaining: number;
  percentageUsed: number;
  isBlocked: boolean;
}

export interface EndpointBreakdownData {
  endpoint: string;
  totalSpent: number;
  transactionCount: number;
  averageCost: number;
  percentage: number;
}

export interface EscalationChartData {
  levelHistory: EscalationLevelHistory[];
  transitionCounts: TransitionCountData[];
  averageTimePerLevel: TimePerLevelData[];
}

export interface EscalationLevelHistory {
  timestamp: number;
  date: string;
  level: EscalationLevel;
  levelNumber: number;
  reason?: string;
}

export interface TransitionCountData {
  fromLevel: EscalationLevel;
  toLevel: EscalationLevel;
  count: number;
}

export interface TimePerLevelData {
  level: EscalationLevel;
  averageMinutes: number;
  totalMinutes: number;
  entryCount: number;
}

export interface ChartTheme {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
    muted: string;
  };
  chainColors: Record<number, string>;
  levelColors: Record<EscalationLevel, string>;
}

export const DEFAULT_CHART_THEME: ChartTheme = {
  colors: {
    primary: '#3B82F6',
    secondary: '#8B5CF6',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#06B6D4',
    muted: '#6B7280',
  },
  chainColors: {
    1: '#627EEA',      // Ethereum - blue
    100: '#04795B',    // Gnosis - green
    42161: '#28A0F0',  // Arbitrum - light blue
    10: '#FF0420',     // Optimism - red
    8453: '#0052FF',   // Base - blue
  },
  levelColors: {
    L0_IDLE: '#10B981',
    L1_WATCH: '#3B82F6',
    L2_ALERT: '#F59E0B',
    L3_CRITICAL: '#EF4444',
    L4_RECOVERY: '#8B5CF6',
    L5_FREEZE: '#1F2937',
    BUDGET_BLOCKED: '#6B7280',
  },
};
