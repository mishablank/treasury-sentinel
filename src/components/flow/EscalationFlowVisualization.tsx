import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  BackgroundVariant,
  ConnectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { nodeTypes, EscalationNodeData, BudgetNodeData } from './EscalationFlowNodes';
import { EscalationFlowBuilder } from './EscalationFlowBuilder';
import { EscalationLevel } from '../../types/escalation';
import { LiquidityMetrics } from '../../types/liquidity';

export interface EscalationFlowProps {
  currentLevel: EscalationLevel;
  budgetSpent: number;
  budgetLimit: number;
  isBudgetBlocked: boolean;
  metrics?: LiquidityMetrics;
  onNodeClick?: (level: EscalationLevel) => void;
}

const builder = new EscalationFlowBuilder();

export function EscalationFlowVisualization({
  currentLevel,
  budgetSpent,
  budgetLimit,
  isBudgetBlocked,
  metrics,
  onNodeClick,
}: EscalationFlowProps): React.ReactElement {
  const initialElements = useMemo(() => {
    const { nodes, edges } = builder.buildFlowElements(currentLevel);
    
    // Update nodes with current state
    const enhancedNodes: Node<EscalationNodeData | BudgetNodeData>[] = nodes.map((node) => {
      if (node.type === 'escalationState') {
        const data = node.data as EscalationNodeData;
        return {
          ...node,
          data: {
            ...data,
            isActive: data.level === currentLevel,
            isBlocked: isBudgetBlocked && data.level !== EscalationLevel.BUDGET_BLOCKED,
            metrics: data.level === currentLevel && metrics ? {
              lcr: metrics.lcr,
              exitHalfLife: metrics.exitHalfLife,
              volatilityRegime: metrics.volatilityRegime,
            } : undefined,
          },
        };
      }
      return node;
    });
    
    // Add budget status node
    enhancedNodes.push({
      id: 'budget-status',
      type: 'budgetStatus',
      position: { x: 600, y: 200 },
      data: {
        spent: budgetSpent,
        limit: budgetLimit,
        isBlocked: isBudgetBlocked,
      },
    });
    
    return { nodes: enhancedNodes, edges };
  }, [currentLevel, budgetSpent, budgetLimit, isBudgetBlocked, metrics]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialElements.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialElements.edges);

  // Update nodes when props change
  React.useEffect(() => {
    setNodes(initialElements.nodes);
    setEdges(initialElements.edges);
  }, [initialElements, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === 'escalationState' && onNodeClick) {
        const data = node.data as EscalationNodeData;
        onNodeClick(data.level);
      }
    },
    [onNodeClick]
  );

  const minimapNodeColor = useCallback((node: Node) => {
    if (node.type === 'budgetStatus') return '#6b7280';
    const data = node.data as EscalationNodeData;
    if (data.isActive) return '#22c55e';
    if (data.level === EscalationLevel.BUDGET_BLOCKED) return '#000000';
    return '#9ca3af';
  }, []);

  return (
    <div className="w-full h-[600px] bg-gray-50 rounded-lg border border-gray-200">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        attributionPosition="bottom-left"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={minimapNodeColor}
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="bg-white border border-gray-200 rounded"
        />
      </ReactFlow>
    </div>
  );
}

export default EscalationFlowVisualization;
