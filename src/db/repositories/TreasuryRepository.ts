import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './BaseRepository';
import { TreasurySnapshotRecord } from '../../types/database';

export class TreasuryRepository extends BaseRepository<TreasurySnapshotRecord> {
  constructor() {
    super('treasury_snapshots');
  }

  protected createTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS treasury_snapshots (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        chain_id INTEGER NOT NULL,
        address TEXT NOT NULL,
        token_address TEXT NOT NULL,
        token_symbol TEXT NOT NULL,
        balance_raw TEXT NOT NULL,
        balance_formatted REAL NOT NULL,
        balance_usd REAL,
        block_number INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_treasury_chain_address ON treasury_snapshots(chain_id, address);
      CREATE INDEX IF NOT EXISTS idx_treasury_timestamp ON treasury_snapshots(timestamp);
      CREATE INDEX IF NOT EXISTS idx_treasury_token ON treasury_snapshots(token_address);
      CREATE INDEX IF NOT EXISTS idx_treasury_block ON treasury_snapshots(chain_id, block_number);
    `);
  }

  create(snapshot: Omit<TreasurySnapshotRecord, 'id' | 'created_at'>): TreasurySnapshotRecord {
    const id = uuidv4();
    const now = new Date().toISOString();

    // Validate required fields
    if (!snapshot.address || !snapshot.address.startsWith('0x')) {
      throw new Error('Invalid treasury address');
    }
    if (!snapshot.token_address || !snapshot.token_address.startsWith('0x')) {
      throw new Error('Invalid token address');
    }
    if (snapshot.balance_formatted < 0) {
      throw new Error('Balance cannot be negative');
    }

    this.runQuery(
      `INSERT INTO treasury_snapshots (id, timestamp, chain_id, address, token_address, token_symbol, balance_raw, balance_formatted, balance_usd, block_number, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        snapshot.timestamp,
        snapshot.chain_id,
        snapshot.address.toLowerCase(),
        snapshot.token_address.toLowerCase(),
        snapshot.token_symbol,
        snapshot.balance_raw,
        snapshot.balance_formatted,
        snapshot.balance_usd ?? null,
        snapshot.block_number,
        now,
      ]
    );

    const record = this.findById(id);
    if (!record) {
      throw new Error('Failed to create treasury snapshot record');
    }
    return record;
  }

  findByChainAndAddress(
    chainId: number,
    address: string,
    limit: number = 100
  ): TreasurySnapshotRecord[] {
    if (limit <= 0 || limit > 10000) {
      limit = 100;
    }
    return this.getAll<TreasurySnapshotRecord>(
      `SELECT * FROM treasury_snapshots 
       WHERE chain_id = ? AND address = ? 
       ORDER BY timestamp DESC LIMIT ?`,
      [chainId, address.toLowerCase(), limit]
    );
  }

  findByToken(tokenAddress: string, limit: number = 100): TreasurySnapshotRecord[] {
    if (limit <= 0 || limit > 10000) {
      limit = 100;
    }
    return this.getAll<TreasurySnapshotRecord>(
      `SELECT * FROM treasury_snapshots 
       WHERE token_address = ? 
       ORDER BY timestamp DESC LIMIT ?`,
      [tokenAddress.toLowerCase(), limit]
    );
  }

  getLatestSnapshot(
    chainId: number,
    address: string,
    tokenAddress: string
  ): TreasurySnapshotRecord | undefined {
    return this.getOne<TreasurySnapshotRecord>(
      `SELECT * FROM treasury_snapshots 
       WHERE chain_id = ? AND address = ? AND token_address = ? 
       ORDER BY timestamp DESC LIMIT 1`,
      [chainId, address.toLowerCase(), tokenAddress.toLowerCase()]
    );
  }

  getSnapshotsInRange(
    chainId: number,
    address: string,
    startTime: string,
    endTime: string
  ): TreasurySnapshotRecord[] {
    return this.getAll<TreasurySnapshotRecord>(
      `SELECT * FROM treasury_snapshots 
       WHERE chain_id = ? AND address = ? 
       AND timestamp >= ? AND timestamp < ? 
       ORDER BY timestamp ASC`,
      [chainId, address.toLowerCase(), startTime, endTime]
    );
  }

  getTotalUsdValue(chainId: number, address: string): number {
    // Get latest snapshot for each token
    const result = this.getOne<{ total: number | null }>(
      `SELECT COALESCE(SUM(balance_usd), 0) as total FROM (
        SELECT balance_usd, ROW_NUMBER() OVER (
          PARTITION BY token_address ORDER BY timestamp DESC
        ) as rn
        FROM treasury_snapshots
        WHERE chain_id = ? AND address = ? AND balance_usd IS NOT NULL
      ) WHERE rn = 1`,
      [chainId, address.toLowerCase()]
    );
    return result?.total ?? 0;
  }

  getUniqueTokens(chainId: number, address: string): string[] {
    const results = this.getAll<{ token_address: string }>(
      `SELECT DISTINCT token_address FROM treasury_snapshots 
       WHERE chain_id = ? AND address = ?`,
      [chainId, address.toLowerCase()]
    );
    return results.map((r) => r.token_address);
  }

  deleteOlderThan(timestamp: string): number {
    const result = this.runQuery<{ changes: number }>(
      'DELETE FROM treasury_snapshots WHERE timestamp < ?',
      [timestamp]
    );
    return result.changes;
  }
}
