/**
 * Base repository implementation with common SQLite operations
 */

import Database from 'better-sqlite3';
import { Repository } from '../../types/database';

export abstract class BaseRepository<T, ID = string> implements Repository<T, ID> {
  protected db: Database.Database;
  protected tableName: string;
  protected idColumn: string;

  constructor(db: Database.Database, tableName: string, idColumn: string = 'id') {
    this.db = db;
    this.tableName = tableName;
    this.idColumn = idColumn;
  }

  abstract mapRowToEntity(row: any): T;
  abstract mapEntityToRow(entity: T): Record<string, any>;

  async findById(id: ID): Promise<T | null> {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${this.idColumn} = ?`);
    const row = stmt.get(id);
    return row ? this.mapRowToEntity(row) : null;
  }

  async findAll(): Promise<T[]> {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName}`);
    const rows = stmt.all();
    return rows.map(row => this.mapRowToEntity(row));
  }

  async save(entity: T): Promise<void> {
    const row = this.mapEntityToRow(entity);
    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(row);

    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`
    );
    stmt.run(...values);
  }

  async delete(id: ID): Promise<boolean> {
    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE ${this.idColumn} = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  protected async findWhere(condition: string, params: any[]): Promise<T[]> {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${condition}`);
    const rows = stmt.all(...params);
    return rows.map(row => this.mapRowToEntity(row));
  }

  protected async findOneWhere(condition: string, params: any[]): Promise<T | null> {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${condition} LIMIT 1`);
    const row = stmt.get(...params);
    return row ? this.mapRowToEntity(row) : null;
  }

  protected async count(condition?: string, params?: any[]): Promise<number> {
    const query = condition
      ? `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${condition}`
      : `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const stmt = this.db.prepare(query);
    const result = params ? stmt.get(...params) : stmt.get();
    return (result as any).count;
  }

  protected async aggregate(column: string, func: 'SUM' | 'AVG' | 'MIN' | 'MAX', condition?: string, params?: any[]): Promise<number> {
    const query = condition
      ? `SELECT ${func}(${column}) as result FROM ${this.tableName} WHERE ${condition}`
      : `SELECT ${func}(${column}) as result FROM ${this.tableName}`;
    const stmt = this.db.prepare(query);
    const result = params ? stmt.get(...params) : stmt.get();
    return (result as any).result ?? 0;
  }
}
