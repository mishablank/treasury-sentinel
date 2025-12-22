/**
 * Custom error classes for treasury-sentinel
 */

export enum ErrorCode {
  // General errors
  UNKNOWN = 'UNKNOWN',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  
  // Budget errors
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  BUDGET_BLOCKED = 'BUDGET_BLOCKED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  
  // Payment errors
  PAYMENT_REQUIRED = 'PAYMENT_REQUIRED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  SETTLEMENT_FAILED = 'SETTLEMENT_FAILED',
  SETTLEMENT_TIMEOUT = 'SETTLEMENT_TIMEOUT',
  
  // API errors
  API_ERROR = 'API_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
  
  // Chain errors
  CHAIN_ERROR = 'CHAIN_ERROR',
  RPC_ERROR = 'RPC_ERROR',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  
  // State machine errors
  INVALID_TRANSITION = 'INVALID_TRANSITION',
  GUARD_FAILED = 'GUARD_FAILED',
  
  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  DUPLICATE_RECORD = 'DUPLICATE_RECORD',
}

export interface ErrorContext {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  cause?: Error;
  timestamp: Date;
  retryable: boolean;
}

export class SentinelError extends Error {
  public readonly code: ErrorCode;
  public readonly details: Record<string, unknown>;
  public readonly timestamp: Date;
  public readonly retryable: boolean;
  public readonly cause?: Error;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      details?: Record<string, unknown>;
      cause?: Error;
      retryable?: boolean;
    } = {}
  ) {
    super(message);
    this.name = 'SentinelError';
    this.code = code;
    this.details = options.details ?? {};
    this.cause = options.cause;
    this.timestamp = new Date();
    this.retryable = options.retryable ?? false;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SentinelError);
    }
  }

  toContext(): ErrorContext {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      cause: this.cause,
      timestamp: this.timestamp,
      retryable: this.retryable,
    };
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      retryable: this.retryable,
      stack: this.stack,
    };
  }
}

export class BudgetError extends SentinelError {
  constructor(
    message: string,
    options: {
      details?: Record<string, unknown>;
      cause?: Error;
    } = {}
  ) {
    super(ErrorCode.BUDGET_EXCEEDED, message, {
      ...options,
      retryable: false,
    });
    this.name = 'BudgetError';
  }
}

export class PaymentError extends SentinelError {
  constructor(
    code: ErrorCode.PAYMENT_REQUIRED | ErrorCode.PAYMENT_FAILED | ErrorCode.SETTLEMENT_FAILED | ErrorCode.SETTLEMENT_TIMEOUT,
    message: string,
    options: {
      details?: Record<string, unknown>;
      cause?: Error;
      retryable?: boolean;
    } = {}
  ) {
    super(code, message, options);
    this.name = 'PaymentError';
  }
}

export class ApiError extends SentinelError {
  public readonly statusCode?: number;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      details?: Record<string, unknown>;
      cause?: Error;
      retryable?: boolean;
    } = {}
  ) {
    const code = options.statusCode === 429 
      ? ErrorCode.RATE_LIMITED 
      : options.statusCode === 401 || options.statusCode === 403
        ? ErrorCode.UNAUTHORIZED
        : options.statusCode === 404
          ? ErrorCode.NOT_FOUND
          : ErrorCode.API_ERROR;

    super(code, message, {
      ...options,
      retryable: options.retryable ?? (options.statusCode === 429 || (options.statusCode ?? 0) >= 500),
    });
    this.name = 'ApiError';
    this.statusCode = options.statusCode;
  }
}

export class ChainError extends SentinelError {
  public readonly chainId?: number;

  constructor(
    message: string,
    options: {
      chainId?: number;
      details?: Record<string, unknown>;
      cause?: Error;
      retryable?: boolean;
    } = {}
  ) {
    super(ErrorCode.CHAIN_ERROR, message, {
      ...options,
      retryable: options.retryable ?? true,
    });
    this.name = 'ChainError';
    this.chainId = options.chainId;
  }
}

export class StateMachineError extends SentinelError {
  constructor(
    code: ErrorCode.INVALID_TRANSITION | ErrorCode.GUARD_FAILED,
    message: string,
    options: {
      details?: Record<string, unknown>;
      cause?: Error;
    } = {}
  ) {
    super(code, message, {
      ...options,
      retryable: false,
    });
    this.name = 'StateMachineError';
  }
}

export class DatabaseError extends SentinelError {
  constructor(
    code: ErrorCode.DATABASE_ERROR | ErrorCode.RECORD_NOT_FOUND | ErrorCode.DUPLICATE_RECORD,
    message: string,
    options: {
      details?: Record<string, unknown>;
      cause?: Error;
      retryable?: boolean;
    } = {}
  ) {
    super(code, message, {
      ...options,
      retryable: options.retryable ?? (code === ErrorCode.DATABASE_ERROR),
    });
    this.name = 'DatabaseError';
  }
}

/**
 * Wrap unknown errors in SentinelError
 */
export function wrapError(error: unknown, context?: string): SentinelError {
  if (error instanceof SentinelError) {
    return error;
  }

  if (error instanceof Error) {
    return new SentinelError(
      ErrorCode.UNKNOWN,
      context ? `${context}: ${error.message}` : error.message,
      { cause: error, retryable: false }
    );
  }

  return new SentinelError(
    ErrorCode.UNKNOWN,
    context ? `${context}: ${String(error)}` : String(error),
    { retryable: false }
  );
}

/**
 * Check if an error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof SentinelError) {
    return error.retryable;
  }
  return false;
}
