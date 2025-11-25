/**
 * Scheduler configuration for APScheduler-style cron jobs
 * Manages 15-minute agent run intervals
 */

export interface SchedulerConfig {
  /** Cron expression for agent runs */
  cronExpression: string;
  /** Timezone for cron schedule */
  timezone: string;
  /** Maximum concurrent jobs */
  maxConcurrentJobs: number;
  /** Job timeout in milliseconds */
  jobTimeout: number;
  /** Enable job persistence across restarts */
  persistJobs: boolean;
  /** Retry configuration */
  retry: RetryConfig;
}

export interface RetryConfig {
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
}

export interface JobDefinition {
  id: string;
  name: string;
  cronExpression: string;
  handler: string;
  enabled: boolean;
  priority: number;
}

export const defaultSchedulerConfig: SchedulerConfig = {
  cronExpression: '*/15 * * * *', // Every 15 minutes
  timezone: 'UTC',
  maxConcurrentJobs: 1,
  jobTimeout: 300000, // 5 minutes
  persistJobs: true,
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 30000,
  },
};

export const SCHEDULED_JOBS: JobDefinition[] = [
  {
    id: 'treasury-monitor',
    name: 'Treasury Monitor Agent',
    cronExpression: '*/15 * * * *',
    handler: 'TreasuryMonitorJob',
    enabled: true,
    priority: 1,
  },
  {
    id: 'budget-check',
    name: 'Budget Enforcement Check',
    cronExpression: '0 * * * *', // Every hour
    handler: 'BudgetCheckJob',
    enabled: true,
    priority: 2,
  },
  {
    id: 'snapshot-cleanup',
    name: 'Old Snapshot Cleanup',
    cronExpression: '0 0 * * *', // Daily at midnight
    handler: 'SnapshotCleanupJob',
    enabled: true,
    priority: 3,
  },
];

/**
 * Parse cron expression to human-readable format
 */
export function describeCronExpression(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return 'Invalid cron expression';

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  if (minute.startsWith('*/')) {
    const interval = minute.slice(2);
    return `Every ${interval} minutes`;
  }

  if (minute === '0' && hour === '*') {
    return 'Every hour on the hour';
  }

  if (minute === '0' && hour === '0') {
    return 'Daily at midnight';
  }

  return `At ${minute} minutes past ${hour === '*' ? 'every hour' : `hour ${hour}`}`;
}
