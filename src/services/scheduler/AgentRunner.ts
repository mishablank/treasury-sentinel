/**
 * APScheduler-style agent runner for Treasury Sentinel
 * Handles 15-minute cron-based agent runs with SQLite persistence
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AgentRun,
  RunStatus,
  ScheduledJob,
  AgentRunQuery,
  AgentRunSummary,
  RunReplayOptions,
  RunReplayResult,
  SchedulerConfig,
  DEFAULT_SCHEDULER_CONFIG,
} from '../../types/scheduler';
import { DatabaseManager } from '../../config/database';

export class AgentRunner {
  private config: SchedulerConfig;
  private db: DatabaseManager;
  private isRunning: boolean = false;
  private currentRun: AgentRun | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private jobId: string;

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
    this.db = new DatabaseManager();
    this.jobId = uuidv4();
  }

  async initialize(): Promise<void> {
    await this.db.initialize();
    await this.ensureTablesExist();
    await this.registerJob();
  }

  private async ensureTablesExist(): Promise<void> {
    const createRunsTable = `
      CREATE TABLE IF NOT EXISTS agent_runs (
        id TEXT PRIMARY KEY,
        run_number INTEGER NOT NULL,
        scheduled_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        escalation_level INTEGER DEFAULT 0,
        treasury_snapshot_id TEXT,
        liquidity_metrics_id TEXT,
        kaiko_request_count INTEGER DEFAULT 0,
        budget_spent_usdc REAL DEFAULT 0,
        error_message TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createJobsTable = `
      CREATE TABLE IF NOT EXISTS scheduled_jobs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        last_run TEXT,
        next_run TEXT,
        run_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await this.db.run(createRunsTable);
    await this.db.run(createJobsTable);
  }

  private async registerJob(): Promise<void> {
    const existingJob = await this.db.get<ScheduledJob>(
      'SELECT * FROM scheduled_jobs WHERE name = ?',
      ['treasury-sentinel-agent']
    );

    if (!existingJob) {
      const nextRun = this.calculateNextRun();
      await this.db.run(
        `INSERT INTO scheduled_jobs (id, name, cron_expression, next_run) VALUES (?, ?, ?, ?)`,
        [this.jobId, 'treasury-sentinel-agent', this.config.cronExpression, nextRun.toISOString()]
      );
    } else {
      this.jobId = existingJob.id;
    }
  }

  private calculateNextRun(): Date {
    // Simple 15-minute interval calculation
    const now = new Date();
    const minutes = now.getMinutes();
    const nextInterval = Math.ceil((minutes + 1) / 15) * 15;
    const nextRun = new Date(now);
    nextRun.setMinutes(nextInterval, 0, 0);
    if (nextRun <= now) {
      nextRun.setMinutes(nextRun.getMinutes() + 15);
    }
    return nextRun;
  }

  async createRun(): Promise<AgentRun> {
    const runNumber = await this.getNextRunNumber();
    const run: AgentRun = {
      id: uuidv4(),
      runNumber,
      scheduledAt: new Date(),
      startedAt: null,
      completedAt: null,
      status: 'pending',
      escalationLevel: 0,
      treasurySnapshotId: null,
      liquidityMetricsId: null,
      kaikoRequestCount: 0,
      budgetSpentUsdc: 0,
      errorMessage: null,
      metadata: {},
    };

    await this.db.run(
      `INSERT INTO agent_runs 
       (id, run_number, scheduled_at, status, escalation_level, metadata) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [run.id, run.runNumber, run.scheduledAt.toISOString(), run.status, run.escalationLevel, JSON.stringify(run.metadata)]
    );

    return run;
  }

  private async getNextRunNumber(): Promise<number> {
    const result = await this.db.get<{ maxRun: number | null }>(
      'SELECT MAX(run_number) as maxRun FROM agent_runs'
    );
    return (result?.maxRun ?? 0) + 1;
  }

  async startRun(runId: string): Promise<void> {
    const startedAt = new Date();
    await this.db.run(
      'UPDATE agent_runs SET started_at = ?, status = ? WHERE id = ?',
      [startedAt.toISOString(), 'running' as RunStatus, runId]
    );
  }

  async completeRun(
    runId: string,
    updates: Partial<Pick<AgentRun, 'escalationLevel' | 'treasurySnapshotId' | 'liquidityMetricsId' | 'kaikoRequestCount' | 'budgetSpentUsdc' | 'metadata'>>
  ): Promise<void> {
    const completedAt = new Date();
    await this.db.run(
      `UPDATE agent_runs SET 
        completed_at = ?, 
        status = ?,
        escalation_level = COALESCE(?, escalation_level),
        treasury_snapshot_id = COALESCE(?, treasury_snapshot_id),
        liquidity_metrics_id = COALESCE(?, liquidity_metrics_id),
        kaiko_request_count = COALESCE(?, kaiko_request_count),
        budget_spent_usdc = COALESCE(?, budget_spent_usdc),
        metadata = COALESCE(?, metadata)
      WHERE id = ?`,
      [
        completedAt.toISOString(),
        'completed' as RunStatus,
        updates.escalationLevel,
        updates.treasurySnapshotId,
        updates.liquidityMetricsId,
        updates.kaikoRequestCount,
        updates.budgetSpentUsdc,
        updates.metadata ? JSON.stringify(updates.metadata) : null,
        runId,
      ]
    );
  }

  async failRun(runId: string, errorMessage: string): Promise<void> {
    const completedAt = new Date();
    await this.db.run(
      'UPDATE agent_runs SET completed_at = ?, status = ?, error_message = ? WHERE id = ?',
      [completedAt.toISOString(), 'failed' as RunStatus, errorMessage, runId]
    );
  }

  async getRun(runId: string): Promise<AgentRun | null> {
    const row = await this.db.get<Record<string, unknown>>(
      'SELECT * FROM agent_runs WHERE id = ?',
      [runId]
    );
    return row ? this.mapRowToAgentRun(row) : null;
  }

  async queryRuns(query: AgentRunQuery): Promise<AgentRun[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.startDate) {
      conditions.push('scheduled_at >= ?');
      params.push(query.startDate.toISOString());
    }
    if (query.endDate) {
      conditions.push('scheduled_at <= ?');
      params.push(query.endDate.toISOString());
    }
    if (query.status) {
      conditions.push('status = ?');
      params.push(query.status);
    }
    if (query.escalationLevel !== undefined) {
      conditions.push('escalation_level = ?');
      params.push(query.escalationLevel);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;

    const rows = await this.db.all<Record<string, unknown>[]>(
      `SELECT * FROM agent_runs ${whereClause} ORDER BY scheduled_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return rows.map(row => this.mapRowToAgentRun(row));
  }

  async getRunSummary(): Promise<AgentRunSummary> {
    const stats = await this.db.get<{
      total: number;
      successful: number;
      failed: number;
      avgDuration: number | null;
      totalBudget: number;
    }>(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
            THEN (julianday(completed_at) - julianday(started_at)) * 86400000 
            ELSE NULL END) as avgDuration,
        SUM(budget_spent_usdc) as totalBudget
      FROM agent_runs`
    );

    const levelCounts = await this.db.all<{ level: number; count: number }[]>(
      `SELECT escalation_level as level, COUNT(*) as count 
       FROM agent_runs 
       GROUP BY escalation_level`
    );

    const runsByEscalationLevel: Record<number, number> = {};
    for (const row of levelCounts) {
      runsByEscalationLevel[row.level] = row.count;
    }

    return {
      totalRuns: stats?.total ?? 0,
      successfulRuns: stats?.successful ?? 0,
      failedRuns: stats?.failed ?? 0,
      averageDuration: stats?.avgDuration ?? 0,
      totalBudgetSpent: stats?.totalBudget ?? 0,
      runsByEscalationLevel,
    };
  }

  async replayRun(options: RunReplayOptions): Promise<RunReplayResult> {
    const originalRun = await this.getRun(options.runId);
    if (!originalRun) {
      throw new Error(`Run not found: ${options.runId}`);
    }

    // Create a new replay run
    const replayRun = await this.createRun();
    replayRun.metadata = {
      ...replayRun.metadata,
      isReplay: true,
      originalRunId: originalRun.id,
      replayOptions: options,
    };

    // For now, return a placeholder result
    // Full implementation would re-execute the run logic
    return {
      originalRun,
      replayRun,
      differences: [],
      success: true,
    };
  }

  private mapRowToAgentRun(row: Record<string, unknown>): AgentRun {
    return {
      id: row.id as string,
      runNumber: row.run_number as number,
      scheduledAt: new Date(row.scheduled_at as string),
      startedAt: row.started_at ? new Date(row.started_at as string) : null,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
      status: row.status as RunStatus,
      escalationLevel: row.escalation_level as number,
      treasurySnapshotId: row.treasury_snapshot_id as string | null,
      liquidityMetricsId: row.liquidity_metrics_id as string | null,
      kaikoRequestCount: row.kaiko_request_count as number,
      budgetSpentUsdc: row.budget_spent_usdc as number,
      errorMessage: row.error_message as string | null,
      metadata: JSON.parse((row.metadata as string) || '{}'),
    };
  }

  async close(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    await this.db.close();
  }
}
