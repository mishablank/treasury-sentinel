/**
 * React Components
 * 
 * All UI components for the Treasury Sentinel dashboard
 */

// Common Components
export * from './common';

// Layout Components
export * from './layout';

// Dashboard
export * from './dashboard';

// Charts
export * from './charts';

// Payment Ledger
export * from './ledger';

// Flow Visualization
export * from './flow';

// Component Categories
export const COMPONENT_CATEGORIES = {
  common: ['LoadingSpinner', 'ErrorBoundary'],
  layout: ['Header', 'Sidebar', 'DashboardLayout'],
  dashboard: ['DashboardPage'],
  charts: ['TreasuryBalanceChart', 'LiquidityMetricsChart', 'VolatilityChart', 'BudgetUsageChart'],
  ledger: ['PaymentLedger'],
  flow: ['EscalationFlowVisualization'],
} as const;
