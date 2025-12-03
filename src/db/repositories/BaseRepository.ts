import Database from 'better-sqlite3';
import { getDatabaseConfig } from '../../config/database';

export interface QueryOptions {
  orderBy?: string;
  order?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export abstract class BaseRepository<T extends Record<string, unknown>> {
  protected db: Database.Database;
  protected tableName: string;
  protected initialized: boolean = false;

  constructor(tableName: string) {
    this.tableName = tableName;
    const config = getDatabaseConfig();
    
    try {
      this.db = new Database(config.filename, {
        verbose: config.verbose ? console.log : undefined,
      });
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize database connection: ${message}`);
    }
  }

  protected abstract createTable(): void;

  protected ensureInitialized(): void {
    if (!this.initialized) {
      try {
        this.createTable();
        this.initialized = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to create table ${this.tableName}: ${message}`);
      }
    }
  }

  protected runQuery<R = unknown>(sql: string, params: unknown[] = []): R {
    this.ensureInitialized();
    try {
      const stmt = this.db.prepare(sql);
      return stmt.run(...params) as R;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Query execution failed on ${this.tableName}: ${message}`);
    }
  }

  protected getOne<R = T>(sql: string, params: unknown[] = []): R | undefined {
    this.ensureInitialized();
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params) as R | undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Query failed on ${this.tableName}: ${message}`);
    }
  }

  protected getAll<R = T>(sql: string, params: unknown[] = []): R[] {
    this.ensureInitialized();
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params) as R[];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Query failed on ${this.tableName}: ${message}`);
    }
  }

  findById(id: string): T | undefined {
    return this.getOne<T>(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
  }

  findAll(options: QueryOptions = {}): T[] {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (options.orderBy) {
      const order = options.order || 'ASC';
      // Sanitize orderBy to prevent SQL injection
      const safeOrderBy = options.orderBy.replace(/[^a-zA-Z0-9_]/g, '');
      sql += ` ORDER BY ${safeOrderBy} ${order}`;
    }

    if (options.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset !== undefined) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    return this.getAll<T>(sql, params);
  }

  deleteById(id: string): boolean {
    const result = this.runQuery<Database.RunResult>(
      `DELETE FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return result.changes > 0;
  }

  count(): number {
    const result = this.getOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.tableName}`
    );
    return result?.count ?? 0;
  }

  truncate(): void {
    this.runQuery(`DELETE FROM ${this.tableName}`);
  }

  close(): void {
    try {
      this.db.close();
    } catch (error) {
      // Ignore close errors
    }
  }

  transaction<R>(fn: () => R): R {
    this.ensureInitialized();
    return this.db.transaction(fn)();
  }
}
