/**
 * @module types/escalation
 * @description Escalation state machine types for risk level management
 * 
 * The escalation system uses a 6-level ladder (L0-L5) to progressively
 * increase monitoring and data acquisition as risk increases.
 */

/**
 * Escalation levels from normal operation (L0) to critical (L5)
 * @description
 * - L0: Normal - Baseline monitoring, no market data needed
 * - L1: Elevated - Increased monitoring frequency
 * - L2: Warning - Basic market data acquisition begins
 * - L3: High - Full market depth analysis
 * - L4: Critical - Real-time monitoring with all data sources
 * - L5: Emergency - Maximum data acquisition, human intervention needed
 */
export type EscalationLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

/**
 * Special system states outside the normal escalation ladder
 */
export type SystemState = 'BUDGET_BLOCKED' | 'PAUSED' | 'ERROR';

/**
 * All possible states the escalation machine can be in
 */
export type EscalationState = EscalationLevel | SystemState;

/**
 * Events that can trigger state transitions
 * @description Each event represents a detected condition or user action
 */
export type EscalationEvent =
  | 'RISK_INCREASE'      // Risk metrics exceeded threshold
  | 'RISK_DECREASE'      // Risk metrics returned to normal
  | 'BUDGET_EXCEEDED'    // 10 USDC demo budget exhausted
  | 'BUDGET_REPLENISHED' // Budget restored (manual action)
  | 'MANUAL_ESCALATE'    // User-initiated escalation
  | 'MANUAL_DEESCALATE'  // User-initiated de-escalation
  | 'SYSTEM_ERROR'       // Unrecoverable error occurred
  | 'SYSTEM_RECOVER'     // Error condition cleared
  | 'PAUSE'              // User paused the system
  | 'RESUME';            // User resumed the system

/**
 * Context passed to guard functions for transition decisions
 * @interface GuardContext
 */
export interface GuardContext {
  /** Current escalation state */
  currentState: EscalationState;
  /** Event attempting to trigger transition */
  event: EscalationEvent;
  /** Current risk metrics snapshot */
  riskMetrics: RiskMetrics;
  /** Current budget status */
  budgetStatus: BudgetStatus;
  /** Timestamp of context creation */
  timestamp: number;
}

/**
 * Risk metrics used for escalation decisions
 * @interface RiskMetrics
 */
export interface RiskMetrics {
  /** Liquidity Coverage Ratio (>100% is healthy) */
  lcr: number;
  /** Time to exit 50% of position (hours) */
  exitHalfLife: number;
  /** Current volatility regime classification */
  volatilityRegime: 'low' | 'medium' | 'high' | 'extreme';
  /** Maximum price impact for full exit (percentage) */
  maxPriceImpact: number;
  /** Overall risk score (0-100) */
  riskScore: number;
}

/**
 * Budget tracking status for micropayment enforcement
 * @interface BudgetStatus
 */
export interface BudgetStatus {
  /** Total budget allocated (USDC) */
  totalBudget: number;
  /** Amount spent so far (USDC) */
  spent: number;
  /** Remaining budget (USDC) */
  remaining: number;
  /** Whether budget is exhausted */
  isExhausted: boolean;
  /** Last payment timestamp */
  lastPaymentTime: number;
}

/**
 * Defines a valid state transition in the escalation machine
 * @interface EscalationTransition
 */
export interface EscalationTransition {
  /** Source state */
  from: EscalationState;
  /** Target state */
  to: EscalationState;
  /** Triggering event */
  event: EscalationEvent;
  /** Guard function name (if any) */
  guard?: string;
  /** Human-readable transition description */
  description: string;
}

/**
 * Complete state machine configuration
 * @interface EscalationConfig
 */
export interface EscalationConfig {
  /** Initial state on startup */
  initialState: EscalationState;
  /** All valid transitions */
  transitions: EscalationTransition[];
  /** State-specific configurations */
  stateConfigs: Record<EscalationState, StateConfig>;
}

/**
 * Configuration specific to each state
 * @interface StateConfig
 */
export interface StateConfig {
  /** Display label for UI */
  label: string;
  /** State description */
  description: string;
  /** Whether market data acquisition is active */
  marketDataEnabled: boolean;
  /** Monitoring interval (minutes) */
  monitoringInterval: number;
  /** Data sources to query in this state */
  dataSources: DataSource[];
  /** Color for UI visualization */
  color: string;
}

/**
 * Available data sources for market data acquisition
 */
export type DataSource = 'kaiko_spot' | 'kaiko_depth' | 'kaiko_trades' | 'kaiko_ohlcv';
