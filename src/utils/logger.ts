/**
 * Structured logging utility for treasury-sentinel
 */

import { ErrorCode, SentinelError } from './errors';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogEntry {
  timestamp: string;
  level: keyof typeof LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  error?: {
    code?: ErrorCode;
    message: string;
    stack?: string;
  };
}

export interface LoggerOptions {
  level: LogLevel;
  context?: string;
  pretty?: boolean;
}

const DEFAULT_OPTIONS: LoggerOptions = {
  level: LogLevel.INFO,
  pretty: process.env.NODE_ENV !== 'production',
};

class Logger {
  private options: LoggerOptions;
  private context?: string;

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.context = options.context;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.options.level;
  }

  private formatEntry(entry: LogEntry): string {
    if (this.options.pretty) {
      const levelColors: Record<string, string> = {
        DEBUG: '\x1b[36m', // Cyan
        INFO: '\x1b[32m',  // Green
        WARN: '\x1b[33m',  // Yellow
        ERROR: '\x1b[31m', // Red
        FATAL: '\x1b[35m', // Magenta
      };
      const reset = '\x1b[0m';
      const color = levelColors[entry.level] || reset;
      
      let output = `${color}[${entry.timestamp}] ${entry.level}${reset}`;
      if (entry.context) {
        output += ` \x1b[90m[${entry.context}]${reset}`;
      }
      output += ` ${entry.message}`;
      
      if (entry.data && Object.keys(entry.data).length > 0) {
        output += `\n  ${JSON.stringify(entry.data, null, 2).split('\n').join('\n  ')}`;
      }
      
      if (entry.error) {
        output += `\n  Error: ${entry.error.message}`;
        if (entry.error.code) {
          output += ` (${entry.error.code})`;
        }
        if (entry.error.stack) {
          output += `\n  ${entry.error.stack.split('\n').slice(1).join('\n  ')}`;
        }
      }
      
      return output;
    }
    
    return JSON.stringify(entry);
  }

  private log(
    level: LogLevel,
    levelName: keyof typeof LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: levelName,
      message,
      context: this.context,
      data,
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
      };
      if (error instanceof SentinelError) {
        entry.error.code = error.code;
      }
    }

    const output = this.formatEntry(entry);

    switch (level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(output);
        break;
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, 'INFO', message, data);
  }

  warn(message: string, data?: Record<string, unknown>, error?: Error): void {
    this.log(LogLevel.WARN, 'WARN', message, data, error);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, 'ERROR', message, data, error);
  }

  fatal(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.log(LogLevel.FATAL, 'FATAL', message, data, error);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: string): Logger {
    const childContext = this.context ? `${this.context}:${context}` : context;
    return new Logger({
      ...this.options,
      context: childContext,
    });
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.options.level = level;
  }

  /**
   * Create a timing helper
   */
  time(label: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.debug(`${label} completed`, { durationMs: Math.round(duration * 100) / 100 });
    };
  }
}

// Default logger instance
export const logger = new Logger();

// Factory function for creating contextual loggers
export function createLogger(context: string, options?: Partial<LoggerOptions>): Logger {
  return new Logger({ ...options, context });
}

export { Logger };
