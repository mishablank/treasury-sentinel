export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: 'treasury' | 'escalation' | 'payments' | 'settings' | 'export';
  active?: boolean;
}

export interface BudgetIndicatorProps {
  spent: number;
  total: number;
  isBlocked: boolean;
}

export interface HeaderProps {
  title: string;
  subtitle?: string;
  budgetStatus: BudgetIndicatorProps;
  lastUpdated?: Date;
}

export interface SidebarProps {
  navigation: NavigationItem[];
  currentPath: string;
  onNavigate: (path: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export interface DashboardLayoutProps {
  children: React.ReactNode;
  navigation: NavigationItem[];
  currentPath: string;
  onNavigate: (path: string) => void;
  budgetStatus: BudgetIndicatorProps;
  lastUpdated?: Date;
}

export interface ChainSelectorProps {
  chains: ChainOption[];
  selectedChains: string[];
  onSelectionChange: (chainIds: string[]) => void;
}

export interface ChainOption {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const DEFAULT_NAVIGATION: NavigationItem[] = [
  { id: 'treasury', label: 'Treasury Overview', href: '/', icon: 'treasury' },
  { id: 'escalation', label: 'Escalation Flow', href: '/escalation', icon: 'escalation' },
  { id: 'payments', label: 'Payment Ledger', href: '/payments', icon: 'payments' },
  { id: 'export', label: 'Export', href: '/export', icon: 'export' },
  { id: 'settings', label: 'Settings', href: '/settings', icon: 'settings' },
];

export const CHAIN_OPTIONS: ChainOption[] = [
  { id: '1', name: 'Ethereum', icon: '⟠', color: '#627EEA' },
  { id: '100', name: 'Gnosis', icon: '🦉', color: '#04795B' },
  { id: '42161', name: 'Arbitrum', icon: '🔵', color: '#28A0F0' },
  { id: '10', name: 'Optimism', icon: '🔴', color: '#FF0420' },
  { id: '8453', name: 'Base', icon: '🔷', color: '#0052FF' },
];
