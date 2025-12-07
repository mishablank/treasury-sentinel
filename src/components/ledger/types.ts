export interface PaymentLedgerEntry {
  id: string;
  timestamp: Date;
  endpoint: string;
  amountUSDC: number;
  txHash: string | null;
  status: 'pending' | 'confirmed' | 'failed';
  escalationLevel: number;
  agentRunId: string | null;
  blockNumber: number | null;
  gasUsed: number | null;
}

export interface LedgerSummary {
  totalSpent: number;
  budgetLimit: number;
  budgetRemaining: number;
  budgetUtilization: number;
  transactionCount: number;
  avgTransactionSize: number;
  lastTransaction: Date | null;
  isBlocked: boolean;
}

export interface LedgerFilter {
  startDate?: Date;
  endDate?: Date;
  status?: PaymentLedgerEntry['status'];
  minAmount?: number;
  maxAmount?: number;
  escalationLevel?: number;
}

export interface LedgerPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface LedgerTableProps {
  entries: PaymentLedgerEntry[];
  pagination: LedgerPagination;
  onPageChange: (page: number) => void;
  onEntryClick?: (entry: PaymentLedgerEntry) => void;
  isLoading?: boolean;
}

export interface BudgetGaugeProps {
  summary: LedgerSummary;
  showWarning?: boolean;
  warningThreshold?: number;
}

export interface LedgerExportOptions {
  format: 'csv' | 'json';
  includeFields: (keyof PaymentLedgerEntry)[];
  filter?: LedgerFilter;
}
