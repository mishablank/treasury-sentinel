import {
  EscalationLevel,
  EscalationState,
  EscalationTransition,
  TransitionTrigger,
} from '../types/escalation';
import { EscalationGuards, GuardContext } from './guards';
import { ESCALATION_CONFIG } from './config';
import { EscalationTransitions, TransitionResult } from './transitions';

export class EscalationStateMachine {
  private state: EscalationState;
  private guards: EscalationGuards;
  private transitions: EscalationTransitions;
  private listeners: ((state: EscalationState, result: TransitionResult) => void)[] = [];

  constructor(initialLevel: EscalationLevel = 'L0') {
    this.state = {
      currentLevel: initialLevel,
      previousLevel: null,
      enteredAt: new Date(),
      transitionCount: 0,
      metadata: {},
    };
    this.guards = new EscalationGuards();
    this.transitions = new EscalationTransitions(this.guards);
  }

  getCurrentState(): EscalationState {
    return { ...this.state };
  }

  getCurrentLevel(): EscalationLevel {
    return this.state.currentLevel;
  }

  getLevelConfig(level: EscalationLevel) {
    return ESCALATION_CONFIG.levels[level];
  }

  canTransitionTo(targetLevel: EscalationLevel, context: GuardContext): boolean {
    return this.transitions.canTransition(this.state.currentLevel, targetLevel, context);
  }

  getBlockingGuards(targetLevel: EscalationLevel, context: GuardContext): string[] {
    return this.transitions.getBlockingGuards(this.state.currentLevel, targetLevel, context);
  }

  getAvailableTransitions(context: GuardContext): EscalationLevel[] {
    return this.transitions.getAvailableTransitions(this.state.currentLevel, context);
  }

  getTransitionPath(targetLevel: EscalationLevel, context: GuardContext): EscalationLevel[] | null {
    return this.transitions.getTransitionPath(this.state.currentLevel, targetLevel, context);
  }

  transition(
    targetLevel: EscalationLevel,
    trigger: TransitionTrigger,
    context: GuardContext
  ): TransitionResult {
    const result = this.transitions.executeTransition(
      this.state,
      targetLevel,
      trigger,
      context
    );

    if (result.success) {
      this.state = {
        currentLevel: targetLevel,
        previousLevel: this.state.currentLevel,
        enteredAt: new Date(),
        transitionCount: this.state.transitionCount + 1,
        metadata: {
          lastTrigger: trigger,
          lastTransitionResult: result,
        },
      };

      this.notifyListeners(result);
    }

    return result;
  }

  escalate(context: GuardContext): TransitionResult | null {
    const currentIndex = this.getLevelIndex(this.state.currentLevel);
    const levels: EscalationLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];

    if (currentIndex >= levels.length - 1) {
      return null; // Already at max level
    }

    const nextLevel = levels[currentIndex + 1];
    return this.transition(nextLevel, 'RISK_THRESHOLD', context);
  }

  deescalate(context: GuardContext): TransitionResult | null {
    const currentIndex = this.getLevelIndex(this.state.currentLevel);
    const levels: EscalationLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];

    if (currentIndex <= 0) {
      return null; // Already at min level
    }

    const prevLevel = levels[currentIndex - 1];
    return this.transition(prevLevel, 'RISK_CLEARED', context);
  }

  reset(): void {
    this.state = {
      currentLevel: 'L0',
      previousLevel: this.state.currentLevel,
      enteredAt: new Date(),
      transitionCount: this.state.transitionCount + 1,
      metadata: { resetAt: new Date() },
    };
  }

  onTransition(listener: (state: EscalationState, result: TransitionResult) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getTransitionHistory(): TransitionResult[] {
    return this.transitions.getTransitionHistory();
  }

  getAllTransitions(): EscalationTransition[] {
    return ESCALATION_CONFIG.transitions;
  }

  private getLevelIndex(level: EscalationLevel): number {
    const levels: EscalationLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
    return levels.indexOf(level);
  }

  private notifyListeners(result: TransitionResult): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state, result);
      } catch (error) {
        console.error('Error in transition listener:', error);
      }
    }
  }
}

export function createStateMachine(initialLevel?: EscalationLevel): EscalationStateMachine {
  return new EscalationStateMachine(initialLevel);
}
