/**
 * APScheduler and agent run types for Treasury Sentinel
 */

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface AgentRun {
  id: string;
  runNumber: number;
  scheduledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  status: RunStatus;
  escalationLevel: number;
  treasurySnapshotId: string | null;
  liquidityMetricsId: string | null;
  kaikoRequestCount: number;
  budgetSpentUsdc: number;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
}

export interface ScheduledJob {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
  runCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RunReplayOptions {
  runId: string;
  dryRun?: boolean;
  skipKaikoRequests?: boolean;
  overrideBudget?: number;
}

export interface RunReplayResult {
  originalRun: AgentRun;
  replayRun: AgentRun;
  differences: RunDifference[];
  success: boolean;
}

export interface RunDifference {
  field: string;
  originalValue: unknown;
  replayValue: unknown;
  significant: boolean;
}

export interface AgentRunQuery {
  startDate?: Date;
  endDate?: Date;
  status?: RunStatus;
  escalationLevel?: number;
  limit?: number;
  offset?: number;
}

export interface AgentRunSummary {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDuration: number;
  totalBudgetSpent: number;
  runsByEscalationLevel: Record<number, number>;
}

export interface SchedulerConfig {
  cronExpression: string;
  timezone: string;
  maxRetries: number;
  retryDelayMs: number;
  runTimeoutMs: number;
  enableReplay: boolean;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  cronExpression: '*/15 * * * *', // Every 15 minutes
  timezone: 'UTC',
  maxRetries: 3,
  retryDelayMs: 5000,
  runTimeoutMs: 300000, // 5 minutes
  enableReplay: true,
};
