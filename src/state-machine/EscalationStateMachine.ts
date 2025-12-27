import {
  EscalationLevel,
  EscalationState,
  EscalationContext,
  EscalationGuard,
  EscalationTransition,
} from '../types/escalation';
import { defaultGuards, validateTransition } from './guards';
import { ESCALATION_LEVELS } from './config';

export interface StateMachineConfig {
  initialLevel: EscalationLevel;
  guards: EscalationGuard[];
  onTransition?: (transition: EscalationTransition) => void;
  onInvalidTransition?: (from: EscalationLevel, to: EscalationLevel, reason: string) => void;
}

export class EscalationStateMachine {
  private currentLevel: EscalationLevel;
  private guards: EscalationGuard[];
  private history: EscalationTransition[] = [];
  private onTransition?: (transition: EscalationTransition) => void;
  private onInvalidTransition?: (from: EscalationLevel, to: EscalationLevel, reason: string) => void;
  private lastContext: EscalationContext | null = null;

  constructor(config: Partial<StateMachineConfig> = {}) {
    this.currentLevel = config.initialLevel ?? 0;
    this.guards = config.guards ?? defaultGuards;
    this.onTransition = config.onTransition;
    this.onInvalidTransition = config.onInvalidTransition;
  }

  getCurrentState(): EscalationState {
    const levelConfig = ESCALATION_LEVELS[this.currentLevel];
    return {
      level: this.currentLevel,
      name: levelConfig.name,
      description: levelConfig.description,
      enteredAt: this.history.length > 0
        ? this.history[this.history.length - 1].timestamp
        : new Date(),
      context: this.lastContext ?? undefined,
    };
  }

  canTransitionTo(targetLevel: EscalationLevel, context: EscalationContext): boolean {
    // First, validate the basic transition
    const validation = validateTransition(this.currentLevel, targetLevel, context);
    if (!validation.valid) {
      return false;
    }

    // Then check specific guards
    const applicableGuards = this.guards.filter(
      (g) => g.from === this.currentLevel && g.to === targetLevel
    );

    // If no specific guards, check if transition is within one level
    if (applicableGuards.length === 0) {
      const levelDiff = Math.abs(targetLevel - this.currentLevel);
      return levelDiff <= 1;
    }

    return applicableGuards.some((guard) => guard.evaluate(context));
  }

  transition(targetLevel: EscalationLevel, context: EscalationContext): boolean {
    // Validate the transition first
    const validation = validateTransition(this.currentLevel, targetLevel, context);
    if (!validation.valid) {
      this.onInvalidTransition?.(this.currentLevel, targetLevel, validation.reason!);
      console.warn(
        `[EscalationStateMachine] Invalid transition L${this.currentLevel} -> L${targetLevel}: ${validation.reason}`
      );
      return false;
    }

    // Check if we can make this transition
    if (!this.canTransitionTo(targetLevel, context)) {
      this.onInvalidTransition?.(
        this.currentLevel,
        targetLevel,
        'Guard conditions not met'
      );
      console.warn(
        `[EscalationStateMachine] Guard conditions not met for L${this.currentLevel} -> L${targetLevel}`
      );
      return false;
    }

    const previousLevel = this.currentLevel;
    this.currentLevel = targetLevel;
    this.lastContext = context;

    const transition: EscalationTransition = {
      from: previousLevel,
      to: targetLevel,
      timestamp: new Date(),
      context,
      triggeredBy: this.determineTriggeredBy(previousLevel, targetLevel, context),
    };

    this.history.push(transition);
    this.onTransition?.(transition);

    console.log(
      `[EscalationStateMachine] Transitioned L${previousLevel} -> L${targetLevel}`
    );

    return true;
  }

  private determineTriggeredBy(
    from: EscalationLevel,
    to: EscalationLevel,
    context: EscalationContext
  ): string {
    if (context.budgetState === 'BUDGET_BLOCKED') {
      return 'budget_blocked';
    }
    if (to > from) {
      if (context.anomalyDetected) return 'anomaly_detected';
      if ((context.volatilityIndex ?? 0) > 0.7) return 'volatility_spike';
      if ((context.lcr ?? 1) < 0.3) return 'liquidity_crisis';
      return 'manual_escalation';
    }
    if (to < from) {
      return 'recovery';
    }
    return 'no_change';
  }

  getHistory(): EscalationTransition[] {
    return [...this.history];
  }

  getAvailableTransitions(context: EscalationContext): EscalationLevel[] {
    const available: EscalationLevel[] = [];
    
    for (let level = 0; level <= 5; level++) {
      if (level !== this.currentLevel && this.canTransitionTo(level as EscalationLevel, context)) {
        available.push(level as EscalationLevel);
      }
    }

    return available;
  }

  reset(): void {
    this.currentLevel = 0;
    this.history = [];
    this.lastContext = null;
  }

  loadState(level: EscalationLevel, history: EscalationTransition[]): void {
    this.currentLevel = level;
    this.history = history;
    if (history.length > 0) {
      this.lastContext = history[history.length - 1].context;
    }
  }
}

export const globalEscalationMachine = new EscalationStateMachine();
