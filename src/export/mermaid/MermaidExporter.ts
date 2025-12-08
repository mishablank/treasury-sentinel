import {
  MermaidExportOptions,
  MermaidExportResult,
  MermaidNode,
  MermaidEdge,
  MermaidDiagramType,
} from './types';
import { EscalationLevel, EscalationEvent } from '../../types/escalation';
import { ESCALATION_CONFIG } from '../../state-machine/config';

export class MermaidExporter {
  private readonly defaultOptions: MermaidExportOptions = {
    direction: 'TB',
    includeGuards: true,
    includeActions: true,
    theme: 'default',
  };

  exportStateDiagram(options: MermaidExportOptions = {}): MermaidExportResult {
    const opts = { ...this.defaultOptions, ...options };
    const lines: string[] = [];

    // Header
    lines.push('stateDiagram-v2');
    lines.push(`    direction ${opts.direction}`);
    lines.push('');

    // Title as comment
    if (opts.title) {
      lines.push(`    %% ${opts.title}`);
      lines.push('');
    }

    // State definitions with descriptions
    const levels = Object.values(EscalationLevel);
    levels.forEach((level) => {
      const config = ESCALATION_CONFIG[level];
      if (config) {
        lines.push(`    ${level}: ${level}`);
        lines.push(`    note right of ${level}: ${config.description || level}`);
      }
    });
    lines.push('');

    // Special states
    lines.push('    BUDGET_BLOCKED: Budget Exhausted');
    lines.push('    note right of BUDGET_BLOCKED: 10 USDC limit reached');
    lines.push('');

    // Initial state
    lines.push('    [*] --> L0_IDLE');
    lines.push('');

    // Transitions
    const transitions = this.buildTransitions();
    transitions.forEach((transition) => {
      let label = transition.label || '';
      if (opts.includeGuards && transition.guard) {
        label += ` [${transition.guard}]`;
      }
      if (label) {
        lines.push(`    ${transition.from} --> ${transition.to}: ${label.trim()}`);
      } else {
        lines.push(`    ${transition.from} --> ${transition.to}`);
      }
    });

    // Highlight current state if specified
    if (opts.highlightCurrentState) {
      lines.push('');
      lines.push(`    classDef current fill:#f96,stroke:#333,stroke-width:4px`);
      lines.push(`    class ${opts.highlightCurrentState} current`);
    }

    const diagram = lines.join('\n');

    return {
      diagram,
      markdown: this.wrapInMarkdown(diagram, 'mermaid'),
    };
  }

  exportFlowchart(options: MermaidExportOptions = {}): MermaidExportResult {
    const opts = { ...this.defaultOptions, ...options };
    const lines: string[] = [];

    // Header
    lines.push(`flowchart ${opts.direction}`);
    lines.push('');

    // Title as comment
    if (opts.title) {
      lines.push(`    %% ${opts.title}`);
      lines.push('');
    }

    // Subgraph for risk levels
    lines.push('    subgraph RiskLevels["Escalation Risk Levels"]');
    
    // Node definitions with shapes
    lines.push('        L0_IDLE(["L0: Idle - No Risk"])');
    lines.push('        L1_POLL[["L1: Polling - Low Risk"]]');
    lines.push('        L2_ALERT{{"L2: Alert - Medium Risk"}}');
    lines.push('        L3_STREAM>"L3: Stream - High Risk"]');
    lines.push('        L4_ACTION[/"L4: Action - Critical Risk"/]');
    lines.push('        L5_EMERGENCY[("L5: Emergency - Severe Risk")]');
    lines.push('    end');
    lines.push('');

    // Budget blocked as separate node
    lines.push('    BUDGET_BLOCKED{{"BUDGET BLOCKED"}}');
    lines.push('');

    // Edges with labels
    const transitions = this.buildTransitions();
    transitions.forEach((transition, index) => {
      let arrow = '-->';
      if (transition.style === 'dotted') {
        arrow = '-.->';
      } else if (transition.style === 'thick') {
        arrow = '==>';
      }

      let label = transition.label || '';
      if (opts.includeGuards && transition.guard) {
        label = `"${label}\n[${transition.guard}]"`;
      } else if (label) {
        label = `"${label}"`;
      }

      if (label) {
        lines.push(`    ${transition.from} ${arrow}|${label}| ${transition.to}`);
      } else {
        lines.push(`    ${transition.from} ${arrow} ${transition.to}`);
      }
    });

    // Styling
    lines.push('');
    lines.push('    %% Styling');
    lines.push('    classDef low fill:#90EE90,stroke:#228B22');
    lines.push('    classDef medium fill:#FFD700,stroke:#FFA500');
    lines.push('    classDef high fill:#FF6347,stroke:#DC143C');
    lines.push('    classDef blocked fill:#808080,stroke:#000000');
    lines.push('');
    lines.push('    class L0_IDLE,L1_POLL low');
    lines.push('    class L2_ALERT,L3_STREAM medium');
    lines.push('    class L4_ACTION,L5_EMERGENCY high');
    lines.push('    class BUDGET_BLOCKED blocked');

    // Highlight current state
    if (opts.highlightCurrentState) {
      lines.push('');
      lines.push('    classDef current stroke:#0000FF,stroke-width:4px');
      lines.push(`    class ${opts.highlightCurrentState} current`);
    }

    const diagram = lines.join('\n');

    return {
      diagram,
      markdown: this.wrapInMarkdown(diagram, 'mermaid'),
    };
  }

  exportWithHistory(
    history: Array<{ from: EscalationLevel; to: EscalationLevel; timestamp: Date }>,
    options: MermaidExportOptions = {}
  ): MermaidExportResult {
    const opts = { ...this.defaultOptions, ...options };
    const lines: string[] = [];

    lines.push('sequenceDiagram');
    lines.push('    autonumber');
    lines.push('');

    if (opts.title) {
      lines.push(`    Note over System: ${opts.title}`);
      lines.push('');
    }

    // Participants
    lines.push('    participant Trigger');
    lines.push('    participant StateMachine');
    lines.push('    participant DataGateway');
    lines.push('');

    // Transitions from history
    history.forEach((transition) => {
      const time = transition.timestamp.toISOString().split('T')[1].slice(0, 8);
      lines.push(`    Trigger->>StateMachine: Transition at ${time}`);
      lines.push(`    StateMachine->>StateMachine: ${transition.from} → ${transition.to}`);
      
      // Add data gateway interaction for escalations
      if (this.getLevelIndex(transition.to) > this.getLevelIndex(transition.from)) {
        lines.push(`    StateMachine->>DataGateway: Request enhanced data`);
        lines.push(`    DataGateway-->>StateMachine: Market data response`);
      }
      lines.push('');
    });

    const diagram = lines.join('\n');

    return {
      diagram,
      markdown: this.wrapInMarkdown(diagram, 'mermaid'),
    };
  }

  private buildTransitions(): Array<{
    from: string;
    to: string;
    label?: string;
    guard?: string;
    style?: 'solid' | 'dotted' | 'thick';
  }> {
    return [
      // Escalation transitions
      { from: 'L0_IDLE', to: 'L1_POLL', label: 'RISK_DETECTED', guard: 'hasRisk' },
      { from: 'L1_POLL', to: 'L2_ALERT', label: 'RISK_ELEVATED', guard: 'riskAboveThreshold' },
      { from: 'L2_ALERT', to: 'L3_STREAM', label: 'RISK_HIGH', guard: 'requiresStreaming' },
      { from: 'L3_STREAM', to: 'L4_ACTION', label: 'RISK_CRITICAL', guard: 'requiresAction' },
      { from: 'L4_ACTION', to: 'L5_EMERGENCY', label: 'RISK_SEVERE', guard: 'emergencyCondition' },
      
      // De-escalation transitions
      { from: 'L5_EMERGENCY', to: 'L4_ACTION', label: 'RISK_DECREASED', style: 'dotted' },
      { from: 'L4_ACTION', to: 'L3_STREAM', label: 'RISK_DECREASED', style: 'dotted' },
      { from: 'L3_STREAM', to: 'L2_ALERT', label: 'RISK_DECREASED', style: 'dotted' },
      { from: 'L2_ALERT', to: 'L1_POLL', label: 'RISK_DECREASED', style: 'dotted' },
      { from: 'L1_POLL', to: 'L0_IDLE', label: 'RISK_CLEARED', style: 'dotted' },
      
      // Budget blocking - can happen from any paid level
      { from: 'L2_ALERT', to: 'BUDGET_BLOCKED', label: 'BUDGET_EXCEEDED', guard: 'budgetExhausted', style: 'thick' },
      { from: 'L3_STREAM', to: 'BUDGET_BLOCKED', label: 'BUDGET_EXCEEDED', guard: 'budgetExhausted', style: 'thick' },
      { from: 'L4_ACTION', to: 'BUDGET_BLOCKED', label: 'BUDGET_EXCEEDED', guard: 'budgetExhausted', style: 'thick' },
      { from: 'L5_EMERGENCY', to: 'BUDGET_BLOCKED', label: 'BUDGET_EXCEEDED', guard: 'budgetExhausted', style: 'thick' },
      
      // Recovery from budget block
      { from: 'BUDGET_BLOCKED', to: 'L0_IDLE', label: 'BUDGET_RESET', guard: 'budgetReplenished', style: 'dotted' },
    ];
  }

  private getLevelIndex(level: EscalationLevel): number {
    const order: EscalationLevel[] = [
      EscalationLevel.L0_IDLE,
      EscalationLevel.L1_POLL,
      EscalationLevel.L2_ALERT,
      EscalationLevel.L3_STREAM,
      EscalationLevel.L4_ACTION,
      EscalationLevel.L5_EMERGENCY,
    ];
    return order.indexOf(level);
  }

  private wrapInMarkdown(diagram: string, type: string): string {
    return `\`\`\`${type}\n${diagram}\n\`\`\``;
  }

  generateMermaidLiveUrl(diagram: string): string {
    const encoded = Buffer.from(diagram).toString('base64');
    return `https://mermaid.live/edit#base64:${encoded}`;
  }
}

export const mermaidExporter = new MermaidExporter();
