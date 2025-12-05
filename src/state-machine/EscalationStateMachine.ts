import {
  EscalationLevel,
  EscalationState,
  EscalationTransition,
  EscalationEvent,
  EscalationContext,
  StateMachineConfig,
} from '../types/escalation';
import {
  canEscalate,
  canDeescalate,
  shouldBlockForBudget,
  getGuardConditions,
} from './guards';
import {
  STATE_CONFIGS,
  TRANSITION_CONFIGS,
  getStateConfig,
  findTransition,
  getTransitionCost,
} from './config';

export class EscalationStateMachine {
  private currentState: EscalationState;
  private history: EscalationTransition[] = [];
  private config: StateMachineConfig;

  constructor(config?: Partial<StateMachineConfig>) {
    this.config = {
      initialLevel: EscalationLevel.L0_IDLE,
      budgetLimit: 10.0,
      autoDeescalate: true,
      deescalateDelayMs: 300000, // 5 minutes
      ...config,
    };

    const stateConfig = getStateConfig(this.config.initialLevel);
    this.currentState = {
      level: this.config.initialLevel,
      enteredAt: new Date(),
      context: {
        treasuryId: '',
        currentSpend: 0,
        budgetLimit: this.config.budgetLimit,
        riskScore: 0,
        liquidityRatio: 1.0,
        volatilityRegime: 'low',
        lastMarketDataFetch: null,
        pendingPaymentId: null,
      },
      metadata: {
        stateName: stateConfig.name,
        stateColor: stateConfig.color,
      },
    };
  }

  getState(): EscalationState {
    return { ...this.currentState };
  }

  getLevel(): EscalationLevel {
    return this.currentState.level;
  }

  getContext(): EscalationContext {
    return { ...this.currentState.context };
  }

  getHistory(): EscalationTransition[] {
    return [...this.history];
  }

  getAvailableTransitions(): EscalationLevel[] {
    const currentLevel = this.currentState.level;
    const context = this.currentState.context;

    return TRANSITION_CONFIGS
      .filter((t) => t.from === currentLevel)
      .filter((t) => this.evaluateGuard(t.guard, context))
      .map((t) => t.to);
  }

  getTransitionCost(targetLevel: EscalationLevel): number {
    return getTransitionCost(this.currentState.level, targetLevel);
  }

  canTransitionTo(targetLevel: EscalationLevel): boolean {
    const transition = findTransition(this.currentState.level, targetLevel);
    if (!transition) return false;
    return this.evaluateGuard(transition.guard, this.currentState.context);
  }

  private evaluateGuard(guardName: string, context: EscalationContext): boolean {
    const guards = getGuardConditions();

    switch (guardName) {
      case 'canStartMonitoring':
        return guards.canStartMonitoring(context);
      case 'shouldEscalateToAlert':
        return guards.shouldEscalateToAlert(context);
      case 'shouldEscalateToMarketData':
        return guards.shouldEscalateToMarketData(context);
      case 'shouldEscalateToCritical':
        return guards.shouldEscalateToCritical(context);
      case 'shouldEscalateToEmergency':
        return guards.shouldEscalateToEmergency(context);
      case 'canDeescalateFromEmergency':
        return guards.canDeescalateFromEmergency(context);
      case 'canDeescalateFromCritical':
        return guards.canDeescalateFromCritical(context);
      case 'canDeescalateFromMarketData':
        return guards.canDeescalateFromMarketData(context);
      case 'canDeescalateFromAlert':
        return guards.canDeescalateFromAlert(context);
      case 'canStopMonitoring':
        return guards.canStopMonitoring(context);
      case 'isBudgetExhausted':
        return shouldBlockForBudget(context);
      case 'hasBudgetRestored':
        return context.currentSpend < context.budgetLimit * 0.9;
      default:
        console.warn(`Unknown guard: ${guardName}`);
        return false;
    }
  }

  async transition(
    targetLevel: EscalationLevel,
    event: EscalationEvent
  ): Promise<EscalationTransition> {
    const fromLevel = this.currentState.level;
    const transitionConfig = findTransition(fromLevel, targetLevel);

    if (!transitionConfig) {
      throw new Error(
        `Invalid transition: ${fromLevel} -> ${targetLevel}`
      );
    }

    if (!this.evaluateGuard(transitionConfig.guard, this.currentState.context)) {
      throw new Error(
        `Guard condition '${transitionConfig.guard}' not satisfied for transition ${fromLevel} -> ${targetLevel}`
      );
    }

    // Check budget for paid transitions
    if (transitionConfig.requiresPayment) {
      const cost = transitionConfig.cost ?? 0;
      const newSpend = this.currentState.context.currentSpend + cost;

      if (newSpend > this.currentState.context.budgetLimit) {
        // Redirect to budget blocked
        return this.transition(EscalationLevel.BUDGET_BLOCKED, {
          type: 'BUDGET_EXCEEDED',
          timestamp: new Date(),
          payload: { requiredAmount: cost, availableBudget: this.currentState.context.budgetLimit - this.currentState.context.currentSpend },
        });
      }

      // Update spend
      this.currentState.context.currentSpend = newSpend;
    }

    const now = new Date();
    const targetConfig = getStateConfig(targetLevel);

    const transition: EscalationTransition = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from: fromLevel,
      to: targetLevel,
      triggeredBy: event,
      timestamp: now,
      guardConditions: [transitionConfig.guard],
      cost: transitionConfig.cost,
    };

    // Update state
    this.currentState = {
      level: targetLevel,
      enteredAt: now,
      context: { ...this.currentState.context },
      previousLevel: fromLevel,
      metadata: {
        stateName: targetConfig.name,
        stateColor: targetConfig.color,
        lastTransition: transition,
      },
    };

    this.history.push(transition);

    return transition;
  }

  updateContext(updates: Partial<EscalationContext>): void {
    this.currentState.context = {
      ...this.currentState.context,
      ...updates,
    };
  }

  async processEvent(event: EscalationEvent): Promise<EscalationTransition | null> {
    const availableTransitions = this.getAvailableTransitions();

    if (availableTransitions.length === 0) {
      return null;
    }

    // Priority: budget block > emergency > critical > market data > alert > monitor > idle
    const priorityOrder = [
      EscalationLevel.BUDGET_BLOCKED,
      EscalationLevel.L5_EMERGENCY,
      EscalationLevel.L4_CRITICAL,
      EscalationLevel.L3_MARKET_DATA,
      EscalationLevel.L2_ALERT,
      EscalationLevel.L1_MONITOR,
      EscalationLevel.L0_IDLE,
    ];

    for (const targetLevel of priorityOrder) {
      if (availableTransitions.includes(targetLevel)) {
        return this.transition(targetLevel, event);
      }
    }

    return null;
  }

  reset(): void {
    const stateConfig = getStateConfig(this.config.initialLevel);
    this.currentState = {
      level: this.config.initialLevel,
      enteredAt: new Date(),
      context: {
        treasuryId: '',
        currentSpend: 0,
        budgetLimit: this.config.budgetLimit,
        riskScore: 0,
        liquidityRatio: 1.0,
        volatilityRegime: 'low',
        lastMarketDataFetch: null,
        pendingPaymentId: null,
      },
      metadata: {
        stateName: stateConfig.name,
        stateColor: stateConfig.color,
      },
    };
    this.history = [];
  }

  exportMermaid(): string {
    const lines: string[] = ['stateDiagram-v2'];

    // Add states
    for (const [level, config] of Object.entries(STATE_CONFIGS)) {
      lines.push(`    ${level}: ${config.name}`);
    }

    lines.push('');

    // Add transitions
    for (const transition of TRANSITION_CONFIGS) {
      const label = transition.cost
        ? `${transition.label} ($${transition.cost})`
        : transition.label;
      lines.push(`    ${transition.from} --> ${transition.to}: ${label}`);
    }

    return lines.join('\n');
  }
}
