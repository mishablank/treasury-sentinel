'use client';

import React from 'react';
import { HeaderProps, BudgetIndicatorProps } from './types';

function BudgetIndicator({ spent, total, isBlocked }: BudgetIndicatorProps): React.ReactElement {
  const percentage = (spent / total) * 100;
  const remaining = total - spent;
  
  const getStatusColor = (): string => {
    if (isBlocked) return 'bg-red-500';
    if (percentage >= 90) return 'bg-orange-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = (): string => {
    if (isBlocked) return 'BUDGET BLOCKED';
    if (percentage >= 90) return 'CRITICAL';
    if (percentage >= 70) return 'WARNING';
    return 'HEALTHY';
  };

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-800 rounded-lg">
      <div className="flex flex-col">
        <span className="text-xs text-gray-400">Budget Status</span>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()} animate-pulse`} />
          <span className="text-sm font-medium text-white">{getStatusText()}</span>
        </div>
      </div>
      
      <div className="h-8 w-px bg-gray-700" />
      
      <div className="flex flex-col">
        <span className="text-xs text-gray-400">Spent / Total</span>
        <span className="text-sm font-mono text-white">
          ${spent.toFixed(2)} / ${total.toFixed(2)} USDC
        </span>
      </div>
      
      <div className="h-8 w-px bg-gray-700" />
      
      <div className="flex flex-col">
        <span className="text-xs text-gray-400">Remaining</span>
        <span className={`text-sm font-mono ${remaining > 0 ? 'text-green-400' : 'text-red-400'}`}>
          ${remaining.toFixed(2)} USDC
        </span>
      </div>
      
      <div className="flex-1 ml-4">
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${getStatusColor()} transition-all duration-300`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function Header({ title, subtitle, budgetStatus, lastUpdated }: HeaderProps): React.ReactElement {
  const formatLastUpdated = (date?: Date): string => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-xl">🏛️</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{title}</h1>
              {subtitle && (
                <p className="text-sm text-gray-400">{subtitle}</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <BudgetIndicator {...budgetStatus} />
          
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>Last sync: {formatLastUpdated(lastUpdated)}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
