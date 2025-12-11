'use client';

import React, { useState, useCallback } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { NavigationItem, DashboardLayoutProps } from './types';

const defaultNavigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/',
    icon: 'dashboard',
    active: true,
  },
  {
    id: 'treasury',
    label: 'Treasury',
    href: '/treasury',
    icon: 'treasury',
  },
  {
    id: 'escalation',
    label: 'Escalation',
    href: '/escalation',
    icon: 'escalation',
  },
  {
    id: 'liquidity',
    label: 'Liquidity',
    href: '/liquidity',
    icon: 'liquidity',
  },
  {
    id: 'payments',
    label: 'Payments',
    href: '/payments',
    icon: 'payments',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: 'settings',
  },
];

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  currentEscalationLevel = 0,
  budgetStatus = {
    remaining: 10,
    total: 10,
    status: 'active',
  },
  navigationItems = defaultNavigationItems,
  className = '',
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentNav, setCurrentNav] = useState<NavigationItem[]>(navigationItems);

  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  const handleNavigationSelect = useCallback((itemId: string) => {
    setCurrentNav(prev =>
      prev.map(item => ({
        ...item,
        active: item.id === itemId,
      }))
    );
  }, []);

  const handleExportDiagram = useCallback(() => {
    // Trigger Mermaid export - will be connected to context
    console.log('Export diagram requested');
  }, []);

  return (
    <div className={`dashboard-layout ${className}`}>
      <style jsx>{`
        .dashboard-layout {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background-color: #0f1117;
        }

        .dashboard-body {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .dashboard-main {
          flex: 1;
          overflow: auto;
          padding: 24px;
          transition: margin-left 0.2s ease;
        }

        .dashboard-main.sidebar-expanded {
          margin-left: 240px;
        }

        .dashboard-main.sidebar-collapsed {
          margin-left: 64px;
        }

        .dashboard-content {
          max-width: 1600px;
          margin: 0 auto;
        }

        @media (max-width: 768px) {
          .dashboard-main {
            margin-left: 0 !important;
            padding: 16px;
          }
        }
      `}</style>

      <Header
        currentLevel={currentEscalationLevel}
        budgetRemaining={budgetStatus.remaining}
        budgetTotal={budgetStatus.total}
        onExportDiagram={handleExportDiagram}
        onToggleSidebar={handleSidebarToggle}
      />

      <div className="dashboard-body">
        <Sidebar
          collapsed={sidebarCollapsed}
          items={currentNav}
          onItemSelect={handleNavigationSelect}
          onCollapseToggle={handleSidebarToggle}
        />

        <main
          className={`dashboard-main ${
            sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'
          }`}
        >
          <div className="dashboard-content">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
