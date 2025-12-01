import { BaseRepository } from './BaseRepository';
import { AgentRunRecord, DatabaseQueryOptions } from '../../types/database';
import { AgentRunStatus, AgentRunResult } from '../../types/scheduler';

export interface AgentRunSummary {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDurationMs: number;
  totalPaymentsUsd: number;
}

export class AgentRunRepository extends BaseRepository {
  async initialize(): Promise<void> {
    await this.run(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        status TEXT NOT NULL,
        escalation_level INTEGER,
        treasuries_checked INTEGER DEFAULT 0,
        alerts_generated INTEGER DEFAULT 0,
        payments_made INTEGER DEFAULT 0,
        total_payment_usd REAL DEFAULT 0,
        error_message TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await this.run(`
      CREATE INDEX IF NOT EXISTS idx_runs_status 
      ON agent_runs(status)
    `);

    await this.run(`
      CREATE INDEX IF NOT EXISTS idx_runs_started 
      ON agent_runs(started_at)
    `);
  }

  async createRun(): Promise<AgentRunRecord> {
    const id = this.generateId();
    const now = new Date().toISOString();

    await this.run(
      `INSERT INTO agent_runs (id, started_at, status, created_at)
       VALUES (?, ?, ?, ?)`,
      [id, now, 'running', now]
    );

    return {
      id,
      startedAt: now,
      completedAt: null,
      status: 'running',
      escalationLevel: null,
      treasuriesChecked: 0,
      alertsGenerated: 0,
      paymentsMade: 0,
      totalPaymentUsd: 0,
      errorMessage: null,
      metadata: null,
      createdAt: now,
    };
  }

  async updateRun(
    id: string,
    updates: Partial<{
      status: AgentRunStatus;
      escalationLevel: number;
      treasuriesChecked: number;
      alertsGenerated: number;
      paymentsMade: number;
      totalPaymentUsd: number;
      errorMessage: string;
      metadata: Record<string, unknown>;
    }>
  ): Promise<void> {
    const setClauses: string[] = [];
    const params: (string | number | null)[] = [];

    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      params.push(updates.status);
    }

    if (updates.escalationLevel !== undefined) {
      setClauses.push('escalation_level = ?');
      params.push(updates.escalationLevel);
    }

    if (updates.treasuriesChecked !== undefined) {
      setClauses.push('treasuries_checked = ?');
      params.push(updates.treasuriesChecked);
    }

    if (updates.alertsGenerated !== undefined) {
      setClauses.push('alerts_generated = ?');
      params.push(updates.alertsGenerated);
    }

    if (updates.paymentsMade !== undefined) {
      setClauses.push('payments_made = ?');
      params.push(updates.paymentsMade);
    }

    if (updates.totalPaymentUsd !== undefined) {
      setClauses.push('total_payment_usd = ?');
      params.push(updates.totalPaymentUsd);
    }

    if (updates.errorMessage !== undefined) {
      setClauses.push('error_message = ?');
      params.push(updates.errorMessage);
    }

    if (updates.metadata !== undefined) {
      setClauses.push('metadata = ?');
      params.push(JSON.stringify(updates.metadata));
    }

    if (setClauses.length === 0) return;

    params.push(id);
    await this.run(
      `UPDATE agent_runs SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );
  }

  async completeRun(id: string, result: AgentRunResult): Promise<void> {
    const now = new Date().toISOString();

    await this.run(
      `UPDATE agent_runs SET 
        completed_at = ?,
        status = ?,
        escalation_level = ?,
        treasuries_checked = ?,
        alerts_generated = ?,
        payments_made = ?,
        total_payment_usd = ?,
        error_message = ?,
        metadata = ?
       WHERE id = ?`,
      [
        now,
        result.status,
        result.escalationLevel ?? null,
        result.treasuriesChecked,
        result.alertsGenerated,
        result.paymentsMade,
        result.totalPaymentUsd,
        result.error ?? null,
        result.metadata ? JSON.stringify(result.metadata) : null,
        id,
      ]
    );
  }

  async getRunById(id: string): Promise<AgentRunRecord | null> {
    const row = await this.get<Record<string, unknown>>(
      'SELECT * FROM agent_runs WHERE id = ?',
      [id]
    );

    return row ? this.mapToRecord(row) : null;
  }

  async getRecentRuns(options: DatabaseQueryOptions = {}): Promise<AgentRunRecord[]> {
    const { limit = 50, offset = 0, startDate, endDate } = options;
    let query = 'SELECT * FROM agent_runs WHERE 1=1';
    const params: (string | number)[] = [];

    if (startDate) {
      query += ' AND started_at >= ?';
      params.push(startDate.toISOString());
    }

    if (endDate) {
      query += ' AND started_at <= ?';
      params.push(endDate.toISOString());
    }

    query += ' ORDER BY started_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await this.all<Record<string, unknown>>(query, params);
    return rows.map(row => this.mapToRecord(row));
  }

  async getRunsByStatus(status: AgentRunStatus): Promise<AgentRunRecord[]> {
    const rows = await this.all<Record<string, unknown>>(
      'SELECT * FROM agent_runs WHERE status = ? ORDER BY started_at DESC',
      [status]
    );
    return rows.map(row => this.mapToRecord(row));
  }

  async getRunSummary(days: number = 7): Promise<AgentRunSummary> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await this.get<{
      total_runs: number;
      successful_runs: number;
      failed_runs: number;
      avg_duration_ms: number;
      total_payments: number;
    }>(
      `SELECT 
        COUNT(*) as total_runs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_runs,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_runs,
        AVG(CASE WHEN completed_at IS NOT NULL 
          THEN (julianday(completed_at) - julianday(started_at)) * 86400000 
          ELSE NULL END) as avg_duration_ms,
        SUM(total_payment_usd) as total_payments
       FROM agent_runs 
       WHERE started_at >= ?`,
      [startDate.toISOString()]
    );

    return {
      totalRuns: result?.total_runs ?? 0,
      successfulRuns: result?.successful_runs ?? 0,
      failedRuns: result?.failed_runs ?? 0,
      averageDurationMs: result?.avg_duration_ms ?? 0,
      totalPaymentsUsd: result?.total_payments ?? 0,
    };
  }

  async getLastSuccessfulRun(): Promise<AgentRunRecord | null> {
    const row = await this.get<Record<string, unknown>>(
      `SELECT * FROM agent_runs 
       WHERE status = 'completed' 
       ORDER BY completed_at DESC LIMIT 1`
    );

    return row ? this.mapToRecord(row) : null;
  }

  async deleteOldRuns(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.run(
      'DELETE FROM agent_runs WHERE started_at < ?',
      [cutoffDate.toISOString()]
    );

    return result.changes ?? 0;
  }

  private mapToRecord(row: Record<string, unknown>): AgentRunRecord {
    return {
      id: row.id as string,
      startedAt: row.started_at as string,
      completedAt: row.completed_at as string | null,
      status: row.status as AgentRunStatus,
      escalationLevel: row.escalation_level as number | null,
      treasuriesChecked: row.treasuries_checked as number,
      alertsGenerated: row.alerts_generated as number,
      paymentsMade: row.payments_made as number,
      totalPaymentUsd: row.total_payment_usd as number,
      errorMessage: row.error_message as string | null,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
      createdAt: row.created_at as string,
    };
  }
}
