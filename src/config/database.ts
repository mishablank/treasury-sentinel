/**
 * Database configuration for SQLite persistence
 * Supports run replay capability and payment ledger tracking
 */

export interface DatabaseConfig {
  /** Path to SQLite database file */
  dbPath: string;
  /** Enable WAL mode for better concurrent read performance */
  walMode: boolean;
  /** Connection timeout in milliseconds */
  connectionTimeout: number;
  /** Maximum number of retry attempts for failed queries */
  maxRetries: number;
  /** Enable verbose SQL logging */
  verbose: boolean;
}

export interface TableSchema {
  name: string;
  createStatement: string;
}

export const defaultDatabaseConfig: DatabaseConfig = {
  dbPath: process.env.DB_PATH || './data/treasury-sentinel.db',
  walMode: true,
  connectionTimeout: 5000,
  maxRetries: 3,
  verbose: process.env.NODE_ENV === 'development',
};

export const TABLE_SCHEMAS: TableSchema[] = [
  {
    name: 'treasury_snapshots',
    createStatement: `
      CREATE TABLE IF NOT EXISTS treasury_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        treasury_id TEXT NOT NULL,
        chain_id INTEGER NOT NULL,
        address TEXT NOT NULL,
        total_value_usd REAL NOT NULL,
        snapshot_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(treasury_id, created_at)
      )
    `,
  },
  {
    name: 'escalation_events',
    createStatement: `
      CREATE TABLE IF NOT EXISTS escalation_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        treasury_id TEXT NOT NULL,
        from_level TEXT NOT NULL,
        to_level TEXT NOT NULL,
        trigger_reason TEXT NOT NULL,
        context_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
  },
  {
    name: 'payment_ledger',
    createStatement: `
      CREATE TABLE IF NOT EXISTS payment_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id TEXT UNIQUE NOT NULL,
        amount_usdc REAL NOT NULL,
        recipient_address TEXT NOT NULL,
        transaction_hash TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        endpoint TEXT NOT NULL,
        request_metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        settled_at DATETIME
      )
    `,
  },
  {
    name: 'agent_runs',
    createStatement: `
      CREATE TABLE IF NOT EXISTS agent_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        treasuries_checked INTEGER DEFAULT 0,
        escalations_triggered INTEGER DEFAULT 0,
        payments_made REAL DEFAULT 0,
        error_message TEXT,
        run_metadata TEXT
      )
    `,
  },
  {
    name: 'budget_tracking',
    createStatement: `
      CREATE TABLE IF NOT EXISTS budget_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        budget_limit_usdc REAL NOT NULL DEFAULT 10.0,
        total_spent_usdc REAL NOT NULL DEFAULT 0.0,
        is_blocked INTEGER NOT NULL DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
  },
];

export const INDEXES: string[] = [
  'CREATE INDEX IF NOT EXISTS idx_snapshots_treasury ON treasury_snapshots(treasury_id)',
  'CREATE INDEX IF NOT EXISTS idx_snapshots_created ON treasury_snapshots(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_escalations_treasury ON escalation_events(treasury_id)',
  'CREATE INDEX IF NOT EXISTS idx_payments_status ON payment_ledger(status)',
  'CREATE INDEX IF NOT EXISTS idx_runs_status ON agent_runs(status)',
];
