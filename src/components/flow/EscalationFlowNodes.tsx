import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { EscalationLevel } from '../../types/escalation';

export interface EscalationNodeData {
  level: EscalationLevel;
  label: string;
  description: string;
  isActive: boolean;
  isBlocked: boolean;
  metrics?: {
    lcr?: number;
    exitHalfLife?: number;
    volatilityRegime?: string;
  };
}

const levelColors: Record<EscalationLevel, { bg: string; border: string; text: string }> = {
  [EscalationLevel.L0_IDLE]: {
    bg: 'bg-gray-100',
    border: 'border-gray-300',
    text: 'text-gray-700',
  },
  [EscalationLevel.L1_MONITORING]: {
    bg: 'bg-blue-100',
    border: 'border-blue-300',
    text: 'text-blue-700',
  },
  [EscalationLevel.L2_ALERT]: {
    bg: 'bg-yellow-100',
    border: 'border-yellow-300',
    text: 'text-yellow-700',
  },
  [EscalationLevel.L3_WARNING]: {
    bg: 'bg-orange-100',
    border: 'border-orange-300',
    text: 'text-orange-700',
  },
  [EscalationLevel.L4_CRITICAL]: {
    bg: 'bg-red-100',
    border: 'border-red-300',
    text: 'text-red-700',
  },
  [EscalationLevel.L5_EMERGENCY]: {
    bg: 'bg-purple-100',
    border: 'border-purple-300',
    text: 'text-purple-700',
  },
  [EscalationLevel.BUDGET_BLOCKED]: {
    bg: 'bg-black',
    border: 'border-red-500',
    text: 'text-white',
  },
};

export const EscalationStateNode = memo(({ data }: NodeProps<EscalationNodeData>) => {
  const colors = levelColors[data.level];
  const activeRing = data.isActive ? 'ring-4 ring-green-400 ring-opacity-50' : '';
  const blockedStyle = data.isBlocked ? 'opacity-50' : '';

  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 shadow-lg min-w-[180px]
        ${colors.bg} ${colors.border} ${activeRing} ${blockedStyle}
        transition-all duration-300 ease-in-out
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-gray-400"
      />
      
      <div className="text-center">
        <div className={`font-bold text-sm ${colors.text}`}>
          {data.label}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {data.description}
        </div>
        
        {data.isActive && (
          <div className="mt-2 flex items-center justify-center">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="ml-2 text-xs text-green-600 font-medium">Active</span>
          </div>
        )}
        
        {data.metrics && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            {data.metrics.lcr !== undefined && (
              <div className="text-xs">
                <span className="text-gray-500">LCR:</span>
                <span className={`ml-1 font-mono ${data.metrics.lcr < 1 ? 'text-red-600' : 'text-green-600'}`}>
                  {(data.metrics.lcr * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {data.metrics.exitHalfLife !== undefined && (
              <div className="text-xs">
                <span className="text-gray-500">Exit t½:</span>
                <span className="ml-1 font-mono">{data.metrics.exitHalfLife.toFixed(1)}h</span>
              </div>
            )}
            {data.metrics.volatilityRegime && (
              <div className="text-xs">
                <span className="text-gray-500">Vol:</span>
                <span className="ml-1 font-mono capitalize">{data.metrics.volatilityRegime}</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-gray-400"
      />
    </div>
  );
});

EscalationStateNode.displayName = 'EscalationStateNode';

export interface BudgetNodeData {
  spent: number;
  limit: number;
  isBlocked: boolean;
}

export const BudgetStatusNode = memo(({ data }: NodeProps<BudgetNodeData>) => {
  const percentage = (data.spent / data.limit) * 100;
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 95 || data.isBlocked;

  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 shadow-lg min-w-[200px]
        ${isCritical ? 'bg-red-50 border-red-400' : isWarning ? 'bg-yellow-50 border-yellow-400' : 'bg-green-50 border-green-400'}
      `}
    >
      <div className="text-center">
        <div className="font-bold text-sm text-gray-800">
          💰 Budget Status
        </div>
        
        <div className="mt-2">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Spent</span>
            <span>${data.spent.toFixed(2)} / ${data.limit.toFixed(2)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                isCritical ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
        
        {data.isBlocked && (
          <div className="mt-2 px-2 py-1 bg-red-100 rounded text-xs text-red-700 font-medium">
            🚫 BUDGET BLOCKED
          </div>
        )}
      </div>
    </div>
  );
});

BudgetStatusNode.displayName = 'BudgetStatusNode';

export const nodeTypes = {
  escalationState: EscalationStateNode,
  budgetStatus: BudgetStatusNode,
};
