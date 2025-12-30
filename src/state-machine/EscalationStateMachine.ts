import { EscalationLevel, EscalationContext, EscalationState, EscalationTransition } from '../types/escalation';
import { LiquidityMetrics } from '../types/liquidity';
import { EscalationGuards, GuardResult } from './guards';
import { BUDGET_CONFIG } from '../config/budget';
import { EventEmitter } from '../events/EventEmitter';

export interface StateMachineConfig {
  initialLevel: EscalationLevel;
  budgetLimit: number;
  cooldownMinutes: number;
  enableStrictMode: boolean;
}

export interface TransitionResult {
  success: boolean;
  previousLevel: EscalationLevel;
  currentLevel: EscalationLevel;
  guardResults: GuardResult[];
  timestamp: Date;
  budgetSpent?: number;
}

export class EscalationStateMachine extends EventEmitter<{
  transition: TransitionResult;
  blocked: { level: EscalationLevel; reason: string };
  budgetExhausted: { remaining: number };
}> {
  private context: EscalationContext;
  private config: StateMachineConfig;
  private transitionHistory: EscalationTransition[] = [];

  constructor(config: Partial<StateMachineConfig> = {}) {
    super();
    this.config = {
      initialLevel: EscalationLevel.L0_IDLE,
      budgetLimit: BUDGET_CONFIG.maxBudgetUsdc,
      cooldownMinutes: 5,
      enableStrictMode: true,
      ...config,
    };

    this.context = {
      currentLevel: this.config.initialLevel,
      budgetRemaining: this.config.budgetLimit,
      budgetSpent: 0,
      lastEscalation: null,
      transitionCount: 0,
    };
  }

  getCurrentState(): EscalationState {
    return {
      level: this.context.currentLevel,
      enteredAt: this.context.lastEscalation || new Date(),
      context: { ...this.context },
    };
  }

  getContext(): EscalationContext {
    return { ...this.context };
  }

  getTransitionHistory(): EscalationTransition[] {
    return [...this.transitionHistory];
  }

  /**
   * Attempt to transition to a new level
   * Fixed: Properly handle BUDGET_BLOCKED state and prevent invalid transitions
   */
  async transition(
    targetLevel: EscalationLevel,
    metrics?: LiquidityMetrics | null,
    force: boolean = false
  ): Promise<TransitionResult> {
    const previousLevel = this.context.currentLevel;
    const timestamp = new Date();

    // Fixed: Check if we're in BUDGET_BLOCKED state (budget < minimum threshold)
    if (this.context.budgetRemaining < BUDGET_CONFIG.minOperationalBudget) {
      const blockedResult: TransitionResult = {
        success: false,
        previousLevel,
        currentLevel: previousLevel,
        guardResults: [{
          allowed: false,
          reason: `System in BUDGET_BLOCKED state: ${this.context.budgetRemaining.toFixed(2)} USDC < ${BUDGET_CONFIG.minOperationalBudget} USDC minimum`,
          blockedBy: 'BUDGET_BLOCKED',
        }],
        timestamp,
      };

      this.emit('blocked', { 
        level: targetLevel, 
        reason: 'BUDGET_BLOCKED' 
      });
      
      return blockedResult;
    }

    // Fixed: Skip guards in force mode but still respect budget limits
    if (force && !this.config.enableStrictMode) {
      return this.executeTransition(targetLevel, [], timestamp);
    }

    // Run all guards
    const { allowed, results } = EscalationGuards.checkAllGuards(
      this.context,
      targetLevel,
      metrics
    );

    if (!allowed && !force) {
      const blockReason = results.find(r => !r.allowed)?.blockedBy || 'UNKNOWN';
      
      this.emit('blocked', { level: targetLevel, reason: blockReason });
      
      return {
        success: false,
        previousLevel,
        currentLevel: previousLevel,
        guardResults: results,
        timestamp,
      };
    }

    return this.executeTransition(targetLevel, results, timestamp);
  }

  /**
   * Execute the actual transition
   * Fixed: Calculate budget cost correctly based on level difference
   */
  private executeTransition(
    targetLevel: EscalationLevel,
    guardResults: GuardResult[],
    timestamp: Date
  ): TransitionResult {
    const previousLevel = this.context.currentLevel;
    
    // Calculate budget cost based on target level
    const levelCosts: Record<EscalationLevel, number> = {
      [EscalationLevel.L0_IDLE]: 0,
      [EscalationLevel.L1_ALERT]: 0.1,
      [EscalationLevel.L2_MONITOR]: 0.5,
      [EscalationLevel.L3_ACTIVE]: 1.0,
      [EscalationLevel.L4_CRITICAL]: 2.0,
      [EscalationLevel.L5_EMERGENCY]: 5.0,
    };

    // Fixed: Only charge for escalation up, not de-escalation
    let budgetSpent = 0;
    if (targetLevel > previousLevel) {
      budgetSpent = levelCosts[targetLevel];
    }

    // Update context
    this.context.currentLevel = targetLevel;
    this.context.budgetSpent += budgetSpent;
    this.context.budgetRemaining -= budgetSpent;
    this.context.lastEscalation = timestamp;
    this.context.transitionCount++;

    // Record transition
    const transition: EscalationTransition = {
      from: previousLevel,
      to: targetLevel,
      timestamp,
      trigger: budgetSpent > 0 ? 'escalation' : 'de-escalation',
      budgetImpact: budgetSpent,
    };
    this.transitionHistory.push(transition);

    const result: TransitionResult = {
      success: true,
      previousLevel,
      currentLevel: targetLevel,
      guardResults,
      timestamp,
      budgetSpent,
    };

    this.emit('transition', result);

    // Fixed: Check if budget is now exhausted after transition
    if (this.context.budgetRemaining < BUDGET_CONFIG.minOperationalBudget) {
      this.emit('budgetExhausted', { remaining: this.context.budgetRemaining });
    }

    return result;
  }

  /**
   * Reset the state machine
   */
  reset(): void {
    this.context = {
      currentLevel: this.config.initialLevel,
      budgetRemaining: this.config.budgetLimit,
      budgetSpent: 0,
      lastEscalation: null,
      transitionCount: 0,
    };
    this.transitionHistory = [];
  }

  /**
   * Check if a transition is possible without executing it
   */
  canTransition(
    targetLevel: EscalationLevel,
    metrics?: LiquidityMetrics | null
  ): { possible: boolean; reasons: string[] } {
    const { allowed, results } = EscalationGuards.checkAllGuards(
      this.context,
      targetLevel,
      metrics
    );

    return {
      possible: allowed,
      reasons: results.map(r => r.reason),
    };
  }
}

export const createStateMachine = (config?: Partial<StateMachineConfig>) => {
  return new EscalationStateMachine(config);
};
