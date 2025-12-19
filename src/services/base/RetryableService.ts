import { BaseService, ServiceConfig } from './BaseService';

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  attempts: number;
  totalTime: number;
  lastError?: Error;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export abstract class RetryableService extends BaseService {
  protected retryConfig: RetryConfig;

  constructor(config: ServiceConfig, retryConfig: Partial<RetryConfig> = {}) {
    super(config);
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  protected async withRetry<T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    let attempts = 0;

    while (attempts < this.retryConfig.maxAttempts) {
      attempts++;
      try {
        const result = await operation();
        return {
          success: true,
          result,
          attempts,
          totalTime: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error as Error;
        
        if (!this.isRetryable(lastError)) {
          break;
        }

        if (attempts < this.retryConfig.maxAttempts) {
          const delay = this.calculateDelay(attempts);
          this.emit('retry', {
            service: this.name,
            context,
            attempt: attempts,
            delay,
            error: lastError.message,
          });
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      attempts,
      totalTime: Date.now() - startTime,
      lastError,
    };
  }

  protected isRetryable(error: Error): boolean {
    if (!this.retryConfig.retryableErrors) {
      return true;
    }
    return this.retryConfig.retryableErrors.some(
      (pattern) => error.message.includes(pattern) || error.name.includes(pattern)
    );
  }

  protected calculateDelay(attempt: number): number {
    const exponentialDelay =
      this.retryConfig.baseDelayMs *
      Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
    
    const jitter = Math.random() * 0.3 * exponentialDelay;
    const delay = exponentialDelay + jitter;
    
    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }
}

export abstract class CircuitBreakerService extends RetryableService {
  private circuitState: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold: number;
  private readonly recoveryTimeout: number;
  private readonly successThreshold: number;
  private consecutiveSuccesses: number = 0;

  constructor(
    config: ServiceConfig,
    retryConfig: Partial<RetryConfig> = {},
    circuitConfig: {
      failureThreshold?: number;
      recoveryTimeout?: number;
      successThreshold?: number;
    } = {}
  ) {
    super(config, retryConfig);
    this.failureThreshold = circuitConfig.failureThreshold ?? 5;
    this.recoveryTimeout = circuitConfig.recoveryTimeout ?? 60000;
    this.successThreshold = circuitConfig.successThreshold ?? 3;
  }

  protected async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T> {
    if (this.circuitState === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.circuitState = 'half-open';
        this.consecutiveSuccesses = 0;
        this.emit('circuit-half-open', { service: this.name, context });
      } else {
        throw new Error(`Circuit breaker is open for service ${this.name}`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.circuitState === 'half-open') {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.successThreshold) {
        this.circuitState = 'closed';
        this.emit('circuit-closed', { service: this.name });
      }
    }
  }

  private onFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.consecutiveSuccesses = 0;

    if (this.circuitState === 'half-open') {
      this.circuitState = 'open';
      this.emit('circuit-open', { service: this.name, error: error.message });
    } else if (this.failureCount >= this.failureThreshold) {
      this.circuitState = 'open';
      this.emit('circuit-open', { service: this.name, error: error.message });
    }
  }

  getCircuitState(): 'closed' | 'open' | 'half-open' {
    return this.circuitState;
  }

  resetCircuit(): void {
    this.circuitState = 'closed';
    this.failureCount = 0;
    this.consecutiveSuccesses = 0;
    this.emit('circuit-reset', { service: this.name });
  }
}
