import { EscalationLevel } from '../types/escalation';
import { TreasurySnapshot } from '../types/treasury';
import { PaymentRecord } from '../types/kaiko';
import { LiquidityMetrics } from '../types/liquidity';
import { AgentRunRecord } from '../types/scheduler';

export type EventType =
  | 'treasury:snapshot'
  | 'treasury:alert'
  | 'escalation:level_change'
  | 'escalation:blocked'
  | 'payment:initiated'
  | 'payment:settled'
  | 'payment:failed'
  | 'liquidity:metrics_updated'
  | 'liquidity:risk_detected'
  | 'agent:run_started'
  | 'agent:run_completed'
  | 'agent:run_failed'
  | 'budget:warning'
  | 'budget:exhausted';

export interface BaseEvent {
  type: EventType;
  timestamp: Date;
  correlationId: string;
}

export interface TreasurySnapshotEvent extends BaseEvent {
  type: 'treasury:snapshot';
  payload: {
    snapshot: TreasurySnapshot;
    chainId: number;
  };
}

export interface TreasuryAlertEvent extends BaseEvent {
  type: 'treasury:alert';
  payload: {
    alertType: 'low_balance' | 'large_outflow' | 'anomaly';
    chainId: number;
    details: Record<string, unknown>;
  };
}

export interface EscalationLevelChangeEvent extends BaseEvent {
  type: 'escalation:level_change';
  payload: {
    previousLevel: EscalationLevel;
    newLevel: EscalationLevel;
    reason: string;
    guardsPassed: string[];
  };
}

export interface EscalationBlockedEvent extends BaseEvent {
  type: 'escalation:blocked';
  payload: {
    attemptedLevel: EscalationLevel;
    reason: 'budget_exhausted' | 'guard_failed' | 'rate_limited';
    details: string;
  };
}

export interface PaymentInitiatedEvent extends BaseEvent {
  type: 'payment:initiated';
  payload: {
    paymentId: string;
    amountUsdc: number;
    dataType: string;
  };
}

export interface PaymentSettledEvent extends BaseEvent {
  type: 'payment:settled';
  payload: {
    payment: PaymentRecord;
    txHash: string;
  };
}

export interface PaymentFailedEvent extends BaseEvent {
  type: 'payment:failed';
  payload: {
    paymentId: string;
    reason: string;
    retryable: boolean;
  };
}

export interface LiquidityMetricsUpdatedEvent extends BaseEvent {
  type: 'liquidity:metrics_updated';
  payload: {
    metrics: LiquidityMetrics;
    symbol: string;
  };
}

export interface LiquidityRiskDetectedEvent extends BaseEvent {
  type: 'liquidity:risk_detected';
  payload: {
    riskType: 'low_lcr' | 'high_volatility' | 'shallow_depth';
    severity: 'warning' | 'critical';
    metrics: Partial<LiquidityMetrics>;
  };
}

export interface AgentRunStartedEvent extends BaseEvent {
  type: 'agent:run_started';
  payload: {
    runId: string;
    scheduledTime: Date;
  };
}

export interface AgentRunCompletedEvent extends BaseEvent {
  type: 'agent:run_completed';
  payload: {
    run: AgentRunRecord;
  };
}

export interface AgentRunFailedEvent extends BaseEvent {
  type: 'agent:run_failed';
  payload: {
    runId: string;
    error: string;
    willRetry: boolean;
  };
}

export interface BudgetWarningEvent extends BaseEvent {
  type: 'budget:warning';
  payload: {
    currentSpent: number;
    budgetLimit: number;
    percentUsed: number;
  };
}

export interface BudgetExhaustedEvent extends BaseEvent {
  type: 'budget:exhausted';
  payload: {
    totalSpent: number;
    budgetLimit: number;
  };
}

export type TreasurySentinelEvent =
  | TreasurySnapshotEvent
  | TreasuryAlertEvent
  | EscalationLevelChangeEvent
  | EscalationBlockedEvent
  | PaymentInitiatedEvent
  | PaymentSettledEvent
  | PaymentFailedEvent
  | LiquidityMetricsUpdatedEvent
  | LiquidityRiskDetectedEvent
  | AgentRunStartedEvent
  | AgentRunCompletedEvent
  | AgentRunFailedEvent
  | BudgetWarningEvent
  | BudgetExhaustedEvent;

export type EventHandler<T extends TreasurySentinelEvent = TreasurySentinelEvent> = (
  event: T
) => void | Promise<void>;

export interface EventSubscription {
  id: string;
  eventType: EventType | '*';
  handler: EventHandler;
  once: boolean;
}

export interface EventEmitterOptions {
  maxListeners?: number;
  enableLogging?: boolean;
  asyncHandlers?: boolean;
}
