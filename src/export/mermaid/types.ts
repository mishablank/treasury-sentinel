export interface MermaidExportOptions {
  title?: string;
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  includeGuards?: boolean;
  includeActions?: boolean;
  highlightCurrentState?: string;
  theme?: 'default' | 'forest' | 'dark' | 'neutral';
}

export interface MermaidNode {
  id: string;
  label: string;
  shape?: 'default' | 'round' | 'stadium' | 'subroutine' | 'cylinder' | 'circle' | 'asymmetric' | 'rhombus' | 'hexagon' | 'parallelogram' | 'trapezoid';
  style?: string;
}

export interface MermaidEdge {
  from: string;
  to: string;
  label?: string;
  style?: 'solid' | 'dotted' | 'thick';
}

export interface MermaidStateDiagram {
  type: 'stateDiagram-v2';
  direction: string;
  states: MermaidNode[];
  transitions: MermaidEdge[];
}

export interface MermaidFlowchart {
  type: 'flowchart';
  direction: string;
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  subgraphs?: MermaidSubgraph[];
}

export interface MermaidSubgraph {
  id: string;
  label: string;
  nodeIds: string[];
}

export interface MermaidExportResult {
  diagram: string;
  markdown: string;
  svgUrl?: string;
}

export type MermaidDiagramType = 'stateDiagram' | 'flowchart';
