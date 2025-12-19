import { EventEmitter } from 'events';
import type { DatabaseConfig } from '../../config/database';

export interface ServiceConfig {
  name: string;
  version: string;
  enabled: boolean;
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  latency?: number;
  details?: Record<string, unknown>;
}

export interface ServiceMetrics {
  requestCount: number;
  errorCount: number;
  averageLatency: number;
  lastUpdated: Date;
}

export abstract class BaseService extends EventEmitter {
  protected readonly name: string;
  protected readonly version: string;
  protected enabled: boolean;
  protected metrics: ServiceMetrics;
  protected health: ServiceHealth;
  protected initialized: boolean = false;

  constructor(config: ServiceConfig) {
    super();
    this.name = config.name;
    this.version = config.version;
    this.enabled = config.enabled;
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      averageLatency: 0,
      lastUpdated: new Date(),
    };
    this.health = {
      status: 'unhealthy',
      lastCheck: new Date(),
    };
  }

  abstract initialize(): Promise<void>;
  abstract shutdown(): Promise<void>;
  abstract healthCheck(): Promise<ServiceHealth>;

  getName(): string {
    return this.name;
  }

  getVersion(): string {
    return this.version;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  enable(): void {
    this.enabled = true;
    this.emit('enabled', { service: this.name });
  }

  disable(): void {
    this.enabled = false;
    this.emit('disabled', { service: this.name });
  }

  getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  getHealth(): ServiceHealth {
    return { ...this.health };
  }

  protected recordRequest(latency: number): void {
    const totalLatency = this.metrics.averageLatency * this.metrics.requestCount + latency;
    this.metrics.requestCount++;
    this.metrics.averageLatency = totalLatency / this.metrics.requestCount;
    this.metrics.lastUpdated = new Date();
  }

  protected recordError(error: Error): void {
    this.metrics.errorCount++;
    this.metrics.lastUpdated = new Date();
    this.emit('error', { service: this.name, error });
  }

  protected async withTiming<T>(operation: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await operation();
      this.recordRequest(Date.now() - start);
      return result;
    } catch (error) {
      this.recordError(error as Error);
      throw error;
    }
  }

  protected updateHealth(status: ServiceHealth['status'], details?: Record<string, unknown>): void {
    this.health = {
      status,
      lastCheck: new Date(),
      details,
    };
    this.emit('health-change', { service: this.name, health: this.health });
  }
}

export abstract class DatabaseAwareService extends BaseService {
  protected dbConfig: DatabaseConfig;

  constructor(config: ServiceConfig, dbConfig: DatabaseConfig) {
    super(config);
    this.dbConfig = dbConfig;
  }

  protected getDatabasePath(): string {
    return this.dbConfig.path;
  }

  protected isWalMode(): boolean {
    return this.dbConfig.walMode;
  }
}

export abstract class CacheableService extends BaseService {
  protected cache: Map<string, { value: unknown; expiry: number }> = new Map();
  protected defaultTtl: number;

  constructor(config: ServiceConfig, defaultTtl: number = 60000) {
    super(config);
    this.defaultTtl = defaultTtl;
  }

  protected getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  protected setCached<T>(key: string, value: T, ttl?: number): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + (ttl ?? this.defaultTtl),
    });
  }

  protected invalidateCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  protected cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }
}
