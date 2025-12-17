import { EventEmitter } from 'events';
import type { BudgetStatus } from '../../config/budget';
import { budgetConfig, checkBudgetAvailable, getBudgetStatus } from '../../config/budget';

export interface ServiceConfig {
  name: string;
  enableBudgetCheck?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface ServiceMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalLatencyMs: number;
  lastCallTimestamp?: Date;
  lastError?: string;
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  metrics: ServiceMetrics;
  budgetStatus?: BudgetStatus;
}

export abstract class BaseService extends EventEmitter {
  protected readonly config: ServiceConfig;
  protected metrics: ServiceMetrics;
  protected initialized: boolean = false;

  constructor(config: ServiceConfig) {
    super();
    this.config = {
      enableBudgetCheck: true,
      maxRetries: 3,
      retryDelayMs: 1000,
      ...config
    };
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalLatencyMs: 0
    };
  }

  public get name(): string {
    return this.config.name;
  }

  public get isInitialized(): boolean {
    return this.initialized;
  }

  protected async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await this.onInitialize();
    this.initialized = true;
    this.emit('initialized', { service: this.name });
  }

  protected abstract onInitialize(): Promise<void>;

  protected async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }
    await this.onShutdown();
    this.initialized = false;
    this.emit('shutdown', { service: this.name });
  }

  protected abstract onShutdown(): Promise<void>;

  protected checkBudget(): boolean {
    if (!this.config.enableBudgetCheck) {
      return true;
    }
    return checkBudgetAvailable(0);
  }

  protected async executeWithMetrics<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();
    this.metrics.totalCalls++;
    this.metrics.lastCallTimestamp = new Date();

    try {
      const result = await operation();
      this.metrics.successfulCalls++;
      this.metrics.totalLatencyMs += Date.now() - startTime;
      
      this.emit('operation:success', {
        service: this.name,
        operation: operationName,
        durationMs: Date.now() - startTime
      });

      return result;
    } catch (error) {
      this.metrics.failedCalls++;
      this.metrics.lastError = error instanceof Error ? error.message : String(error);
      this.metrics.totalLatencyMs += Date.now() - startTime;

      this.emit('operation:error', {
        service: this.name,
        operation: operationName,
        error: this.metrics.lastError,
        durationMs: Date.now() - startTime
      });

      throw error;
    }
  }

  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;
    const maxRetries = this.config.maxRetries ?? 3;
    const retryDelay = this.config.retryDelayMs ?? 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeWithMetrics(operation, operationName);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          this.emit('operation:retry', {
            service: this.name,
            operation: operationName,
            attempt,
            maxRetries,
            error: lastError.message
          });
          
          await this.delay(retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getHealth(): ServiceHealth {
    const successRate = this.metrics.totalCalls > 0
      ? this.metrics.successfulCalls / this.metrics.totalCalls
      : 1;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (successRate >= 0.95 && this.initialized) {
      status = 'healthy';
    } else if (successRate >= 0.7) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      lastCheck: new Date(),
      metrics: { ...this.metrics },
      budgetStatus: this.config.enableBudgetCheck ? getBudgetStatus() : undefined
    };
  }

  public getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  public getAverageLatency(): number {
    if (this.metrics.totalCalls === 0) {
      return 0;
    }
    return this.metrics.totalLatencyMs / this.metrics.totalCalls;
  }

  public resetMetrics(): void {
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalLatencyMs: 0
    };
    this.emit('metrics:reset', { service: this.name });
  }
}
