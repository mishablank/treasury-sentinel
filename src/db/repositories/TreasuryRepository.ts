import { BaseRepository } from './BaseRepository';
import {
  TreasurySnapshotRecord,
  BalanceRecord,
  DatabaseQueryOptions,
} from '../../types/database';
import { TreasurySnapshot, TokenBalance } from '../../types/treasury';
import { ChainId } from '../../config/chains';

export class TreasuryRepository extends BaseRepository {
  async initialize(): Promise<void> {
    await this.run(`
      CREATE TABLE IF NOT EXISTS treasury_snapshots (
        id TEXT PRIMARY KEY,
        chain_id INTEGER NOT NULL,
        address TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        block_number INTEGER NOT NULL,
        native_balance TEXT NOT NULL,
        total_usd_value REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS token_balances (
        id TEXT PRIMARY KEY,
        snapshot_id TEXT NOT NULL,
        token_address TEXT NOT NULL,
        symbol TEXT NOT NULL,
        decimals INTEGER NOT NULL,
        balance TEXT NOT NULL,
        usd_value REAL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (snapshot_id) REFERENCES treasury_snapshots(id)
      )
    `);

    await this.run(`
      CREATE INDEX IF NOT EXISTS idx_snapshots_chain_address 
      ON treasury_snapshots(chain_id, address)
    `);

    await this.run(`
      CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp 
      ON treasury_snapshots(timestamp)
    `);

    await this.run(`
      CREATE INDEX IF NOT EXISTS idx_balances_snapshot 
      ON token_balances(snapshot_id)
    `);
  }

  async saveSnapshot(snapshot: TreasurySnapshot): Promise<TreasurySnapshotRecord> {
    const id = this.generateId();
    const now = new Date().toISOString();

    await this.run(
      `INSERT INTO treasury_snapshots 
       (id, chain_id, address, timestamp, block_number, native_balance, total_usd_value, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        snapshot.chainId,
        snapshot.address,
        snapshot.timestamp.toISOString(),
        snapshot.blockNumber,
        snapshot.nativeBalance,
        snapshot.totalUsdValue,
        now,
      ]
    );

    // Save token balances
    for (const balance of snapshot.tokenBalances) {
      await this.saveTokenBalance(id, balance);
    }

    return {
      id,
      chainId: snapshot.chainId,
      address: snapshot.address,
      timestamp: snapshot.timestamp.toISOString(),
      blockNumber: snapshot.blockNumber,
      nativeBalance: snapshot.nativeBalance,
      totalUsdValue: snapshot.totalUsdValue,
      createdAt: now,
    };
  }

  private async saveTokenBalance(
    snapshotId: string,
    balance: TokenBalance
  ): Promise<BalanceRecord> {
    const id = this.generateId();
    const now = new Date().toISOString();

    await this.run(
      `INSERT INTO token_balances 
       (id, snapshot_id, token_address, symbol, decimals, balance, usd_value, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        snapshotId,
        balance.tokenAddress,
        balance.symbol,
        balance.decimals,
        balance.balance,
        balance.usdValue ?? null,
        now,
      ]
    );

    return {
      id,
      snapshotId,
      tokenAddress: balance.tokenAddress,
      symbol: balance.symbol,
      decimals: balance.decimals,
      balance: balance.balance,
      usdValue: balance.usdValue ?? null,
      createdAt: now,
    };
  }

  async getLatestSnapshot(
    chainId: ChainId,
    address: string
  ): Promise<TreasurySnapshotRecord | null> {
    return this.get<TreasurySnapshotRecord>(
      `SELECT * FROM treasury_snapshots 
       WHERE chain_id = ? AND address = ? 
       ORDER BY timestamp DESC LIMIT 1`,
      [chainId, address]
    );
  }

  async getSnapshotBalances(snapshotId: string): Promise<BalanceRecord[]> {
    return this.all<BalanceRecord>(
      'SELECT * FROM token_balances WHERE snapshot_id = ?',
      [snapshotId]
    );
  }

  async getSnapshotHistory(
    chainId: ChainId,
    address: string,
    options: DatabaseQueryOptions = {}
  ): Promise<TreasurySnapshotRecord[]> {
    const { limit = 100, offset = 0, startDate, endDate } = options;
    let query = 'SELECT * FROM treasury_snapshots WHERE chain_id = ? AND address = ?';
    const params: (string | number)[] = [chainId, address];

    if (startDate) {
      query += ' AND timestamp >= ?';
      params.push(startDate.toISOString());
    }

    if (endDate) {
      query += ' AND timestamp <= ?';
      params.push(endDate.toISOString());
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.all<TreasurySnapshotRecord>(query, params);
  }

  async getTotalValueHistory(
    chainId: ChainId,
    address: string,
    days: number = 30
  ): Promise<{ timestamp: string; totalUsdValue: number }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.all<{ timestamp: string; totalUsdValue: number }>(
      `SELECT timestamp, total_usd_value as totalUsdValue 
       FROM treasury_snapshots 
       WHERE chain_id = ? AND address = ? AND timestamp >= ?
       ORDER BY timestamp ASC`,
      [chainId, address, startDate.toISOString()]
    );
  }

  async getAggregatedBalance(
    address: string
  ): Promise<{ chainId: number; totalUsdValue: number }[]> {
    return this.all<{ chainId: number; totalUsdValue: number }>(
      `SELECT chain_id as chainId, total_usd_value as totalUsdValue
       FROM treasury_snapshots s1
       WHERE address = ? AND timestamp = (
         SELECT MAX(timestamp) FROM treasury_snapshots s2 
         WHERE s2.chain_id = s1.chain_id AND s2.address = s1.address
       )`,
      [address]
    );
  }

  async deleteOldSnapshots(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // First delete associated balances
    await this.run(
      `DELETE FROM token_balances WHERE snapshot_id IN (
        SELECT id FROM treasury_snapshots WHERE timestamp < ?
      )`,
      [cutoffDate.toISOString()]
    );

    // Then delete snapshots
    const result = await this.run(
      'DELETE FROM treasury_snapshots WHERE timestamp < ?',
      [cutoffDate.toISOString()]
    );

    return result.changes ?? 0;
  }
}
