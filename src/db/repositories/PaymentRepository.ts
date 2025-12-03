import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './BaseRepository';
import { PaymentRecord, PaymentStatus } from '../../types/database';

export class PaymentRepository extends BaseRepository<PaymentRecord> {
  constructor() {
    super('payments');
  }

  protected createTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        amount_usdc REAL NOT NULL CHECK(amount_usdc >= 0),
        recipient TEXT NOT NULL,
        tx_hash TEXT,
        status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'failed', 'refunded')),
        chain_id INTEGER NOT NULL,
        purpose TEXT NOT NULL,
        kaiko_request_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
      CREATE INDEX IF NOT EXISTS idx_payments_timestamp ON payments(timestamp);
      CREATE INDEX IF NOT EXISTS idx_payments_chain_id ON payments(chain_id);
      CREATE INDEX IF NOT EXISTS idx_payments_kaiko_request ON payments(kaiko_request_id);
    `);
  }

  create(payment: Omit<PaymentRecord, 'id' | 'created_at' | 'updated_at'>): PaymentRecord {
    const id = uuidv4();
    const now = new Date().toISOString();

    // Validate required fields
    if (!payment.recipient || payment.recipient.trim() === '') {
      throw new Error('Payment recipient is required');
    }
    if (payment.amount_usdc < 0) {
      throw new Error('Payment amount cannot be negative');
    }

    this.runQuery(
      `INSERT INTO payments (id, timestamp, amount_usdc, recipient, tx_hash, status, chain_id, purpose, kaiko_request_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        payment.timestamp,
        payment.amount_usdc,
        payment.recipient,
        payment.tx_hash ?? null,
        payment.status,
        payment.chain_id,
        payment.purpose,
        payment.kaiko_request_id ?? null,
        now,
        now,
      ]
    );

    const record = this.findById(id);
    if (!record) {
      throw new Error('Failed to create payment record');
    }
    return record;
  }

  updateStatus(id: string, status: PaymentStatus, txHash?: string): PaymentRecord | undefined {
    const now = new Date().toISOString();
    const params: unknown[] = [status, now, id];
    let sql = 'UPDATE payments SET status = ?, updated_at = ?';

    if (txHash !== undefined) {
      sql += ', tx_hash = ?';
      params.splice(2, 0, txHash);
    }

    sql += ' WHERE id = ?';

    const result = this.runQuery<{ changes: number }>(sql, params);
    if (result.changes === 0) {
      return undefined;
    }
    return this.findById(id);
  }

  findByStatus(status: PaymentStatus): PaymentRecord[] {
    return this.getAll<PaymentRecord>(
      'SELECT * FROM payments WHERE status = ? ORDER BY timestamp DESC',
      [status]
    );
  }

  findByKaikoRequestId(requestId: string): PaymentRecord | undefined {
    return this.getOne<PaymentRecord>(
      'SELECT * FROM payments WHERE kaiko_request_id = ?',
      [requestId]
    );
  }

  getTotalSpent(): number {
    const result = this.getOne<{ total: number | null }>(
      `SELECT COALESCE(SUM(amount_usdc), 0) as total FROM payments WHERE status IN ('confirmed', 'pending')`
    );
    return result?.total ?? 0;
  }

  getSpentInPeriod(startTime: string, endTime: string): number {
    const result = this.getOne<{ total: number | null }>(
      `SELECT COALESCE(SUM(amount_usdc), 0) as total FROM payments 
       WHERE status IN ('confirmed', 'pending') 
       AND timestamp >= ? AND timestamp < ?`,
      [startTime, endTime]
    );
    return result?.total ?? 0;
  }

  getRecentPayments(limit: number = 10): PaymentRecord[] {
    if (limit <= 0 || limit > 1000) {
      limit = 10;
    }
    return this.getAll<PaymentRecord>(
      'SELECT * FROM payments ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
  }

  findPendingPayments(): PaymentRecord[] {
    return this.findByStatus('pending');
  }

  findByChainId(chainId: number): PaymentRecord[] {
    return this.getAll<PaymentRecord>(
      'SELECT * FROM payments WHERE chain_id = ? ORDER BY timestamp DESC',
      [chainId]
    );
  }
}
