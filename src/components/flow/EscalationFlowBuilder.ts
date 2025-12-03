import { MarkerType, Position } from 'reactflow';
import {
  EscalationNode,
  EscalationEdge,
  EscalationNodeData,
  EscalationEdgeData,
  FlowConfig,
  DEFAULT_FLOW_CONFIG,
  LEVEL_DESCRIPTIONS,
  GUARD_LABELS,
  createNodeId,
  createEdgeId,
} from './EscalationFlowTypes';
import {
  EscalationLevel,
  EscalationState,
  GuardCondition,
  StateTransition,
} from '../../types/escalation';

export interface TransitionDefinition {
  from: EscalationLevel;
  to: EscalationLevel;
  guard: GuardCondition;
}

const ESCALATION_TRANSITIONS: TransitionDefinition[] = [
  // Escalation path
  { from: EscalationLevel.L0_IDLE, to: EscalationLevel.L1_PASSIVE, guard: GuardCondition.TIME_ELAPSED },
  { from: EscalationLevel.L1_PASSIVE, to: EscalationLevel.L2_ACTIVE, guard: GuardCondition.LCR_BELOW_THRESHOLD },
  { from: EscalationLevel.L2_ACTIVE, to: EscalationLevel.L3_ELEVATED, guard: GuardCondition.VOLATILITY_SPIKE },
  { from: EscalationLevel.L3_ELEVATED, to: EscalationLevel.L4_CRITICAL, guard: GuardCondition.LCR_BELOW_THRESHOLD },
  { from: EscalationLevel.L4_CRITICAL, to: EscalationLevel.L5_EMERGENCY, guard: GuardCondition.LIQUIDITY_CRISIS },
  
  // De-escalation path
  { from: EscalationLevel.L5_EMERGENCY, to: EscalationLevel.L4_CRITICAL, guard: GuardCondition.COOLDOWN_EXPIRED },
  { from: EscalationLevel.L4_CRITICAL, to: EscalationLevel.L3_ELEVATED, guard: GuardCondition.COOLDOWN_EXPIRED },
  { from: EscalationLevel.L3_ELEVATED, to: EscalationLevel.L2_ACTIVE, guard: GuardCondition.COOLDOWN_EXPIRED },
  { from: EscalationLevel.L2_ACTIVE, to: EscalationLevel.L1_PASSIVE, guard: GuardCondition.COOLDOWN_EXPIRED },
  { from: EscalationLevel.L1_PASSIVE, to: EscalationLevel.L0_IDLE, guard: GuardCondition.TIME_ELAPSED },
  
  // Budget blocking transitions
  { from: EscalationLevel.L2_ACTIVE, to: EscalationLevel.L1_PASSIVE, guard: GuardCondition.BUDGET_EXHAUSTED },
  { from: EscalationLevel.L3_ELEVATED, to: EscalationLevel.L1_PASSIVE, guard: GuardCondition.BUDGET_EXHAUSTED },
  { from: EscalationLevel.L4_CRITICAL, to: EscalationLevel.L1_PASSIVE, guard: GuardCondition.BUDGET_EXHAUSTED },
  { from: EscalationLevel.L5_EMERGENCY, to: EscalationLevel.L1_PASSIVE, guard: GuardCondition.BUDGET_EXHAUSTED },
  
  // Manual override
  { from: EscalationLevel.L0_IDLE, to: EscalationLevel.L5_EMERGENCY, guard: GuardCondition.MANUAL_OVERRIDE },
];

export class EscalationFlowBuilder {
  private config: FlowConfig;
  private currentState?: EscalationState;
  private transitionHistory: StateTransition[] = [];

  constructor(config: Partial<FlowConfig> = {}) {
    this.config = { ...DEFAULT_FLOW_CONFIG, ...config };
  }

  setCurrentState(state: EscalationState): this {
    this.currentState = state;
    return this;
  }

  setTransitionHistory(history: StateTransition[]): this {
    this.transitionHistory = history;
    return this;
  }

  buildNodes(): EscalationNode[] {
    const levels = Object.values(EscalationLevel).filter(
      (v) => typeof v === 'number'
    ) as EscalationLevel[];

    return levels.map((level, index) => {
      const isActive = this.currentState?.currentLevel === level;
      const isBlocked = this.currentState?.budgetBlocked && isActive;

      const nodeData: EscalationNodeData = {
        level,
        label: EscalationLevel[level],
        description: LEVEL_DESCRIPTIONS[level],
        isActive,
        isBlocked: isBlocked || false,
        enteredAt: isActive ? this.currentState?.enteredAt : undefined,
        metrics: isActive
          ? {
              lcr: this.currentState?.metrics.lcr,
              volatilityRegime: this.currentState?.metrics.volatilityRegime,
              budgetRemaining: this.currentState?.metrics.budgetRemaining,
            }
          : undefined,
      };

      const node: EscalationNode = {
        id: createNodeId(level),
        type: 'escalationNode',
        position: {
          x: 100,
          y: index * this.config.nodeSpacing.vertical,
        },
        data: nodeData,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };

      return node;
    });
  }

  buildEdges(): EscalationEdge[] {
    const edges: EscalationEdge[] = [];
    const transitionCounts = this.calculateTransitionCounts();

    for (const transition of ESCALATION_TRANSITIONS) {
      const edgeId = createEdgeId(transition.from, transition.to);
      const count = transitionCounts.get(edgeId) || 0;
      const lastTransition = this.findLastTransition(transition.from, transition.to);

      const isEscalation = transition.to > transition.from;
      const isBudgetBlock = transition.guard === GuardCondition.BUDGET_EXHAUSTED;

      const edgeData: EscalationEdgeData = {
        guard: transition.guard,
        guardLabel: GUARD_LABELS[transition.guard],
        transitionCount: count,
        lastTransition,
      };

      const edge: EscalationEdge = {
        id: edgeId,
        source: createNodeId(transition.from),
        target: createNodeId(transition.to),
        type: 'escalationEdge',
        animated: count > 0,
        data: edgeData,
        label: GUARD_LABELS[transition.guard],
        labelStyle: {
          fontSize: 10,
          fontWeight: count > 0 ? 600 : 400,
        },
        labelBgStyle: {
          fill: isBudgetBlock ? '#fef2f2' : '#f3f4f6',
          fillOpacity: 0.8,
        },
        style: {
          stroke: isBudgetBlock
            ? this.config.colors.blocked
            : count > 0
            ? this.config.colors.edgeActive
            : this.config.colors.edge,
          strokeWidth: count > 0 ? 2 : 1,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 15,
          height: 15,
          color: isBudgetBlock
            ? this.config.colors.blocked
            : count > 0
            ? this.config.colors.edgeActive
            : this.config.colors.edge,
        },
      };

      edges.push(edge);
    }

    return edges;
  }

  build(): { nodes: EscalationNode[]; edges: EscalationEdge[] } {
    return {
      nodes: this.buildNodes(),
      edges: this.buildEdges(),
    };
  }

  private calculateTransitionCounts(): Map<string, number> {
    const counts = new Map<string, number>();

    for (const transition of this.transitionHistory) {
      const edgeId = createEdgeId(transition.fromLevel, transition.toLevel);
      counts.set(edgeId, (counts.get(edgeId) || 0) + 1);
    }

    return counts;
  }

  private findLastTransition(
    from: EscalationLevel,
    to: EscalationLevel
  ): Date | undefined {
    for (let i = this.transitionHistory.length - 1; i >= 0; i--) {
      const transition = this.transitionHistory[i];
      if (transition.fromLevel === from && transition.toLevel === to) {
        return transition.timestamp;
      }
    }
    return undefined;
  }

  static getTransitionDefinitions(): TransitionDefinition[] {
    return [...ESCALATION_TRANSITIONS];
  }
}
