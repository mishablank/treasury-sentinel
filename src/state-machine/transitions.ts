import {
  EscalationLevel,
  EscalationState,
  EscalationTransition,
  TransitionTrigger,
} from '../types/escalation';
import { EscalationGuards, GuardContext } from './guards';
import { ESCALATION_CONFIG } from './config';

export interface TransitionResult {
  success: boolean;
  fromLevel: EscalationLevel;
  toLevel: EscalationLevel;
  trigger: TransitionTrigger;
  timestamp: Date;
  guardsPassed: string[];
  guardsFailed: string[];
  metadata?: Record<string, unknown>;
}

export interface TransitionValidator {
  canTransition(from: EscalationLevel, to: EscalationLevel, context: GuardContext): boolean;
  getBlockingGuards(from: EscalationLevel, to: EscalationLevel, context: GuardContext): string[];
}

export class EscalationTransitions implements TransitionValidator {
  private guards: EscalationGuards;
  private transitionHistory: TransitionResult[] = [];
  private maxHistorySize: number = 1000;

  constructor(guards: EscalationGuards) {
    this.guards = guards;
  }

  canTransition(from: EscalationLevel, to: EscalationLevel, context: GuardContext): boolean {
    // Check if transition is defined
    if (!this.isTransitionDefined(from, to)) {
      return false;
    }

    // Check all guard conditions
    const blockingGuards = this.getBlockingGuards(from, to, context);
    return blockingGuards.length === 0;
  }

  getBlockingGuards(from: EscalationLevel, to: EscalationLevel, context: GuardContext): string[] {
    const blocking: string[] = [];
    const transition = this.findTransition(from, to);

    if (!transition) {
      blocking.push('TRANSITION_NOT_DEFINED');
      return blocking;
    }

    // Check global guards
    if (context.budgetBlocked) {
      blocking.push('BUDGET_BLOCKED');
    }

    if (context.systemPaused) {
      blocking.push('SYSTEM_PAUSED');
    }

    // Check level-specific guards
    const levelGuards = this.getLevelGuards(to, context);
    blocking.push(...levelGuards);

    return blocking;
  }

  executeTransition(
    currentState: EscalationState,
    targetLevel: EscalationLevel,
    trigger: TransitionTrigger,
    context: GuardContext
  ): TransitionResult {
    const fromLevel = currentState.currentLevel;
    const guardsPassed: string[] = [];
    const guardsFailed: string[] = [];

    // Validate transition
    const blockingGuards = this.getBlockingGuards(fromLevel, targetLevel, context);
    
    if (blockingGuards.length > 0) {
      const result: TransitionResult = {
        success: false,
        fromLevel,
        toLevel: targetLevel,
        trigger,
        timestamp: new Date(),
        guardsPassed,
        guardsFailed: blockingGuards,
      };
      this.recordTransition(result);
      return result;
    }

    // All guards passed
    guardsPassed.push('ALL_GUARDS_PASSED');

    const result: TransitionResult = {
      success: true,
      fromLevel,
      toLevel: targetLevel,
      trigger,
      timestamp: new Date(),
      guardsPassed,
      guardsFailed,
      metadata: {
        previousState: currentState,
        context,
      },
    };

    this.recordTransition(result);
    return result;
  }

  getAvailableTransitions(currentLevel: EscalationLevel, context: GuardContext): EscalationLevel[] {
    const available: EscalationLevel[] = [];
    const allLevels: EscalationLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];

    for (const targetLevel of allLevels) {
      if (targetLevel !== currentLevel && this.canTransition(currentLevel, targetLevel, context)) {
        available.push(targetLevel);
      }
    }

    return available;
  }

  getTransitionPath(
    from: EscalationLevel,
    to: EscalationLevel,
    context: GuardContext
  ): EscalationLevel[] | null {
    // BFS to find shortest valid path
    const visited = new Set<EscalationLevel>();
    const queue: { level: EscalationLevel; path: EscalationLevel[] }[] = [
      { level: from, path: [from] },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.level === to) {
        return current.path;
      }

      if (visited.has(current.level)) {
        continue;
      }
      visited.add(current.level);

      const available = this.getAvailableTransitions(current.level, context);
      for (const next of available) {
        if (!visited.has(next)) {
          queue.push({
            level: next,
            path: [...current.path, next],
          });
        }
      }
    }

    return null; // No valid path found
  }

  getTransitionHistory(): TransitionResult[] {
    return [...this.transitionHistory];
  }

  clearHistory(): void {
    this.transitionHistory = [];
  }

  private isTransitionDefined(from: EscalationLevel, to: EscalationLevel): boolean {
    return this.findTransition(from, to) !== undefined;
  }

  private findTransition(from: EscalationLevel, to: EscalationLevel): EscalationTransition | undefined {
    return ESCALATION_CONFIG.transitions.find(
      (t) => t.from === from && t.to === to
    );
  }

  private getLevelGuards(targetLevel: EscalationLevel, context: GuardContext): string[] {
    const blocking: string[] = [];

    switch (targetLevel) {
      case 'L1':
        if (!this.guards.canEscalateToL1(context)) {
          blocking.push('L1_GUARD_FAILED');
        }
        break;
      case 'L2':
        if (!this.guards.canEscalateToL2(context)) {
          blocking.push('L2_GUARD_FAILED');
        }
        break;
      case 'L3':
        if (!this.guards.canEscalateToL3(context)) {
          blocking.push('L3_GUARD_FAILED');
        }
        break;
      case 'L4':
        if (!this.guards.canEscalateToL4(context)) {
          blocking.push('L4_GUARD_FAILED');
        }
        break;
      case 'L5':
        if (!this.guards.canEscalateToL5(context)) {
          blocking.push('L5_GUARD_FAILED');
        }
        break;
      case 'L0':
        if (!this.guards.canDeescalate(context)) {
          blocking.push('DEESCALATION_GUARD_FAILED');
        }
        break;
    }

    return blocking;
  }

  private recordTransition(result: TransitionResult): void {
    this.transitionHistory.push(result);

    // Trim history if needed
    if (this.transitionHistory.length > this.maxHistorySize) {
      this.transitionHistory = this.transitionHistory.slice(-this.maxHistorySize);
    }
  }
}

export function createTransitionValidator(guards: EscalationGuards): TransitionValidator {
  return new EscalationTransitions(guards);
}
