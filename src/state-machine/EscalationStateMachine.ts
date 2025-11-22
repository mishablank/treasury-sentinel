import {
  EscalationLevel,
  EscalationState,
  EscalationTransition,
  GuardCondition,
  StateTransitionResult,
} from '../types/escalation';

export interface StateMachineConfig {
  initialLevel: EscalationLevel;
  budgetLimit: number;
  currentBudgetUsed: number;
}

export interface TransitionGuard {
  name: string;
  condition: GuardCondition;
  errorMessage: string;
}

const LEVEL_ORDER: EscalationLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];

const ESCALATION_COSTS: Record<EscalationLevel, number> = {
  L0: 0,
  L1: 0.1,
  L2: 0.25,
  L3: 0.5,
  L4: 1.0,
  L5: 2.5,
};

export class EscalationStateMachine {
  private currentState: EscalationState;
  private transitionHistory: EscalationTransition[] = [];
  private guards: Map<string, TransitionGuard[]> = new Map();
  private budgetLimit: number;
  private budgetUsed: number;

  constructor(config: StateMachineConfig) {
    this.budgetLimit = config.budgetLimit;
    this.budgetUsed = config.currentBudgetUsed;
    this.currentState = {
      level: config.initialLevel,
      enteredAt: new Date(),
      reason: 'Initial state',
      metadata: {},
    };
    this.initializeDefaultGuards();
  }

  private initializeDefaultGuards(): void {
    // Budget guard - applies to all escalation transitions
    const budgetGuard: TransitionGuard = {
      name: 'budget_check',
      condition: (from, to) => {
        const cost = ESCALATION_COSTS[to];
        return this.budgetUsed + cost <= this.budgetLimit;
      },
      errorMessage: 'Insufficient budget for escalation',
    };

    // Sequential escalation guard - can only go up one level at a time
    const sequentialGuard: TransitionGuard = {
      name: 'sequential_escalation',
      condition: (from, to) => {
        const fromIndex = LEVEL_ORDER.indexOf(from);
        const toIndex = LEVEL_ORDER.indexOf(to);
        // Allow de-escalation to any lower level, but escalation must be sequential
        return toIndex <= fromIndex + 1;
      },
      errorMessage: 'Can only escalate one level at a time',
    };

    // Apply guards to all transitions
    for (const level of LEVEL_ORDER) {
      this.guards.set(level, [budgetGuard, sequentialGuard]);
    }
  }

  public addGuard(forLevel: EscalationLevel, guard: TransitionGuard): void {
    const existingGuards = this.guards.get(forLevel) || [];
    existingGuards.push(guard);
    this.guards.set(forLevel, existingGuards);
  }

  public getCurrentState(): EscalationState {
    return { ...this.currentState };
  }

  public getCurrentLevel(): EscalationLevel {
    return this.currentState.level;
  }

  public getRemainingBudget(): number {
    return this.budgetLimit - this.budgetUsed;
  }

  public getEscalationCost(level: EscalationLevel): number {
    return ESCALATION_COSTS[level];
  }

  public canTransitionTo(targetLevel: EscalationLevel): StateTransitionResult {
    const guards = this.guards.get(targetLevel) || [];
    const failedGuards: string[] = [];

    for (const guard of guards) {
      if (!guard.condition(this.currentState.level, targetLevel)) {
        failedGuards.push(guard.errorMessage);
      }
    }

    if (failedGuards.length > 0) {
      return {
        success: false,
        previousLevel: this.currentState.level,
        newLevel: this.currentState.level,
        failedGuards,
      };
    }

    return {
      success: true,
      previousLevel: this.currentState.level,
      newLevel: targetLevel,
      cost: ESCALATION_COSTS[targetLevel],
    };
  }

  public transitionTo(
    targetLevel: EscalationLevel,
    reason: string,
    metadata: Record<string, unknown> = {}
  ): StateTransitionResult {
    const canTransition = this.canTransitionTo(targetLevel);

    if (!canTransition.success) {
      return canTransition;
    }

    const previousLevel = this.currentState.level;
    const cost = ESCALATION_COSTS[targetLevel];

    // Record the transition
    const transition: EscalationTransition = {
      from: previousLevel,
      to: targetLevel,
      timestamp: new Date(),
      reason,
      cost,
      triggeredBy: metadata.triggeredBy as string || 'system',
    };

    this.transitionHistory.push(transition);

    // Update budget
    this.budgetUsed += cost;

    // Update current state
    this.currentState = {
      level: targetLevel,
      enteredAt: new Date(),
      reason,
      metadata,
    };

    return {
      success: true,
      previousLevel,
      newLevel: targetLevel,
      cost,
    };
  }

  public escalate(reason: string, metadata?: Record<string, unknown>): StateTransitionResult {
    const currentIndex = LEVEL_ORDER.indexOf(this.currentState.level);
    
    if (currentIndex >= LEVEL_ORDER.length - 1) {
      return {
        success: false,
        previousLevel: this.currentState.level,
        newLevel: this.currentState.level,
        failedGuards: ['Already at maximum escalation level'],
      };
    }

    const nextLevel = LEVEL_ORDER[currentIndex + 1];
    return this.transitionTo(nextLevel, reason, metadata);
  }

  public deescalate(reason: string, metadata?: Record<string, unknown>): StateTransitionResult {
    const currentIndex = LEVEL_ORDER.indexOf(this.currentState.level);
    
    if (currentIndex <= 0) {
      return {
        success: false,
        previousLevel: this.currentState.level,
        newLevel: this.currentState.level,
        failedGuards: ['Already at minimum escalation level'],
      };
    }

    const prevLevel = LEVEL_ORDER[currentIndex - 1];
    return this.transitionTo(prevLevel, reason, metadata);
  }

  public getTransitionHistory(): EscalationTransition[] {
    return [...this.transitionHistory];
  }

  public getTotalCost(): number {
    return this.transitionHistory.reduce((sum, t) => sum + t.cost, 0);
  }

  public isBudgetBlocked(): boolean {
    // Check if we can't even do the cheapest escalation
    const currentIndex = LEVEL_ORDER.indexOf(this.currentState.level);
    if (currentIndex >= LEVEL_ORDER.length - 1) {
      return false; // Already at max, not blocked
    }
    
    const nextLevel = LEVEL_ORDER[currentIndex + 1];
    const nextCost = ESCALATION_COSTS[nextLevel];
    return this.budgetUsed + nextCost > this.budgetLimit;
  }

  public toJSON(): object {
    return {
      currentState: this.currentState,
      transitionHistory: this.transitionHistory,
      budgetLimit: this.budgetLimit,
      budgetUsed: this.budgetUsed,
      remainingBudget: this.getRemainingBudget(),
      isBudgetBlocked: this.isBudgetBlocked(),
    };
  }
}
