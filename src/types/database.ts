/**
 * Database types for SQLite persistence
 */

import { EscalationLevel, EscalationState } from './escalation';
import { TreasurySnapshot } from './treasury';
import { AgentRunRecord, AgentRunStatus } from './scheduler';
import { LiquidityMetrics } from './liquidity';

export interface DBTreasurySnapshot {
  id: string;
  chainId: number;
  treasuryAddress: string;
  tokenAddress: string;
  symbol: string;
  balance: string;
  decimals: number;
  usdValue: number;
  timestamp: number;
  createdAt: number;
}

export interface DBEscalationEvent {
  id: string;
  runId: string;
  fromLevel: EscalationLevel;
  toLevel: EscalationLevel;
  trigger: string;
  guardsPassed: string; // JSON array
  guardsFailed: string; // JSON array
  timestamp: number;
  metadata: string; // JSON object
}

export interface DBAgentRun {
  id: string;
  startTime: number;
  endTime: number | null;
  status: AgentRunStatus;
  escalationLevel: EscalationLevel;
  budgetUsed: number;
  dataSourcesCalled: string; // JSON array
  errorsEncountered: string; // JSON array
  metricsComputed: string; // JSON object
}

export interface DBPaymentRecord {
  id: string;
  runId: string;
  endpoint: string;
  amountUSDC: number;
  txHash: string | null;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  metadata: string; // JSON object
}

export interface DBLiquiditySnapshot {
  id: string;
  runId: string;
  chainId: number;
  tokenAddress: string;
  lcr: number;
  exitHalfLife: number;
  volatilityRegime: string;
  depthBands: string; // JSON array
  timestamp: number;
}

export interface DatabaseConfig {
  path: string;
  enableWAL: boolean;
  busyTimeout: number;
}

export interface Repository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: ID): Promise<boolean>;
}

export interface TreasuryRepository extends Repository<DBTreasurySnapshot> {
  findByChainAndAddress(chainId: number, address: string): Promise<DBTreasurySnapshot[]>;
  findLatestByToken(chainId: number, tokenAddress: string): Promise<DBTreasurySnapshot | null>;
  findInTimeRange(startTime: number, endTime: number): Promise<DBTreasurySnapshot[]>;
}

export interface EscalationRepository extends Repository<DBEscalationEvent> {
  findByRunId(runId: string): Promise<DBEscalationEvent[]>;
  findByLevel(level: EscalationLevel): Promise<DBEscalationEvent[]>;
  findLatest(limit: number): Promise<DBEscalationEvent[]>;
}

export interface AgentRunRepository extends Repository<DBAgentRun> {
  findByStatus(status: AgentRunStatus): Promise<DBAgentRun[]>;
  findInTimeRange(startTime: number, endTime: number): Promise<DBAgentRun[]>;
  findLatest(limit: number): Promise<DBAgentRun[]>;
  updateStatus(id: string, status: AgentRunStatus, endTime?: number): Promise<void>;
}

export interface PaymentRepository extends Repository<DBPaymentRecord> {
  findByRunId(runId: string): Promise<DBPaymentRecord[]>;
  findByStatus(status: 'pending' | 'confirmed' | 'failed'): Promise<DBPaymentRecord[]>;
  getTotalSpent(): Promise<number>;
  updateStatus(id: string, status: 'pending' | 'confirmed' | 'failed', txHash?: string): Promise<void>;
}

export interface LiquidityRepository extends Repository<DBLiquiditySnapshot> {
  findByRunId(runId: string): Promise<DBLiquiditySnapshot[]>;
  findByToken(chainId: number, tokenAddress: string): Promise<DBLiquiditySnapshot[]>;
  findLatestByToken(chainId: number, tokenAddress: string): Promise<DBLiquiditySnapshot | null>;
}
