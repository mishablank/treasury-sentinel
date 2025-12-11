'use client';

import React from 'react';
import { SidebarProps, NavigationItem } from './types';

function NavigationIcon({ icon }: { icon: NavigationItem['icon'] }): React.ReactElement {
  const icons: Record<NavigationItem['icon'], string> = {
    treasury: '💰',
    escalation: '📊',
    payments: '💳',
    settings: '⚙️',
    export: '📤',
  };
  
  return <span className="text-lg">{icons[icon]}</span>;
}

export function Sidebar({
  navigation,
  currentPath,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps): React.ReactElement {
  const isActive = (href: string): boolean => {
    if (href === '/') return currentPath === '/';
    return currentPath.startsWith(href);
  };

  return (
    <aside
      className={`bg-gray-900 border-r border-gray-800 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Collapse Toggle */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-4 text-gray-400 hover:text-white transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="text-lg">{collapsed ? '→' : '←'}</span>
          </button>
        )}
        
        {/* Navigation */}
        <nav className="flex-1 py-4">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const active = isActive(item.href);
              
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onNavigate(item.href)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      active
                        ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-500'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <NavigationIcon icon={item.icon} />
                    {!collapsed && (
                      <span className="font-medium">{item.label}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        
        {/* Footer */}
        <div className={`p-4 border-t border-gray-800 ${collapsed ? 'text-center' : ''}`}>
          {!collapsed ? (
            <div className="text-xs text-gray-500">
              <p className="font-medium text-gray-400">Treasury Sentinel</p>
              <p>DAO CFO Risk Console</p>
              <p className="mt-1">v1.0.0</p>
            </div>
          ) : (
            <span className="text-lg">🏛️</span>
          )}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
