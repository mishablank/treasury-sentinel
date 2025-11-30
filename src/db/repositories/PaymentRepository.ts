/**
 * Payment repository for tracking USDC micropayments
 */

import Database from 'better-sqlite3';
import { BaseRepository } from './BaseRepository';
import { DBPaymentRecord, PaymentRepository as IPaymentRepository } from '../../types/database';

export class PaymentRepository extends BaseRepository<DBPaymentRecord> implements IPaymentRepository {
  constructor(db: Database.Database) {
    super(db, 'payment_records', 'id');
  }

  mapRowToEntity(row: any): DBPaymentRecord {
    return {
      id: row.id,
      runId: row.run_id,
      endpoint: row.endpoint,
      amountUSDC: row.amount_usdc,
      txHash: row.tx_hash,
      status: row.status,
      timestamp: row.timestamp,
      metadata: row.metadata,
    };
  }

  mapEntityToRow(entity: DBPaymentRecord): Record<string, any> {
    return {
      id: entity.id,
      run_id: entity.runId,
      endpoint: entity.endpoint,
      amount_usdc: entity.amountUSDC,
      tx_hash: entity.txHash,
      status: entity.status,
      timestamp: entity.timestamp,
      metadata: entity.metadata,
    };
  }

  async findByRunId(runId: string): Promise<DBPaymentRecord[]> {
    return this.findWhere('run_id = ?', [runId]);
  }

  async findByStatus(status: 'pending' | 'confirmed' | 'failed'): Promise<DBPaymentRecord[]> {
    return this.findWhere('status = ?', [status]);
  }

  async getTotalSpent(): Promise<number> {
    return this.aggregate('amount_usdc', 'SUM', "status = 'confirmed'");
  }

  async updateStatus(id: string, status: 'pending' | 'confirmed' | 'failed', txHash?: string): Promise<void> {
    if (txHash) {
      const stmt = this.db.prepare(
        'UPDATE payment_records SET status = ?, tx_hash = ? WHERE id = ?'
      );
      stmt.run(status, txHash, id);
    } else {
      const stmt = this.db.prepare(
        'UPDATE payment_records SET status = ? WHERE id = ?'
      );
      stmt.run(status, id);
    }
  }

  async getPendingTotal(): Promise<number> {
    return this.aggregate('amount_usdc', 'SUM', "status = 'pending'");
  }

  async getSpentByEndpoint(): Promise<Map<string, number>> {
    const stmt = this.db.prepare(
      "SELECT endpoint, SUM(amount_usdc) as total FROM payment_records WHERE status = 'confirmed' GROUP BY endpoint"
    );
    const rows = stmt.all() as { endpoint: string; total: number }[];
    return new Map(rows.map(r => [r.endpoint, r.total]));
  }

  async getSpentInTimeRange(startTime: number, endTime: number): Promise<number> {
    return this.aggregate(
      'amount_usdc',
      'SUM',
      "status = 'confirmed' AND timestamp >= ? AND timestamp <= ?",
      [startTime, endTime]
    );
  }
}
