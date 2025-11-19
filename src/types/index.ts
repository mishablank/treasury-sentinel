/**
 * Central type exports for treasury-sentinel
 */

export * from './treasury';
export * from './escalation';

// Payment and metering types
export interface PaymentRecord {
  id: string;
  timestamp: Date;
  amount: number; // USDC amount
  txHash: string | null;
  chain: 'base';
  status: 'pending' | 'confirmed' | 'failed';
  purpose: string;
  escalationLevel: import('./escalation').EscalationLevel;
}

export interface BudgetState {
  totalBudget: number;
  spent: number;
  remaining: number;
  isBlocked: boolean;
  payments: PaymentRecord[];
}

export const DEMO_BUDGET_LIMIT = 10; // 10 USDC

// Agent run types
export interface AgentRun {
  id: string;
  startTime: Date;
  endTime: Date | null;
  status: 'running' | 'completed' | 'failed';
  escalationLevel: import('./escalation').EscalationLevel;
  snapshotsCollected: number;
  dataFetched: string[];
  costIncurred: number;
  error?: string;
}

export interface AgentSchedule {
  cronExpression: string;
  lastRun: Date | null;
  nextRun: Date | null;
  isActive: boolean;
}

// HTTP 402 types
export interface HTTP402Challenge {
  paymentRequired: true;
  amount: number;
  currency: 'USDC';
  chain: 'base';
  recipient: string;
  memo: string;
  expiresAt: Date;
}

export interface HTTP402Response {
  status: 402;
  challenge: HTTP402Challenge;
}
