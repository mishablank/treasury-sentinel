import { BudgetConfig, BudgetState } from '../types/treasury';

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  maxBudgetUSDC: 10,
  warningThresholdPercent: 80,
  criticalThresholdPercent: 95,
  autoBlockEnabled: true,
};

export interface BudgetStatus {
  spent: number;
  remaining: number;
  percentUsed: number;
  state: BudgetState;
  isBlocked: boolean;
  lastUpdated: Date;
}

export type BudgetState = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'BUDGET_BLOCKED';

export class BudgetEnforcer {
  private config: BudgetConfig;
  private spent: number = 0;
  private locked: boolean = false;
  private lockPromise: Promise<void> | null = null;
  private lastUpdated: Date = new Date();

  constructor(config: BudgetConfig = DEFAULT_BUDGET_CONFIG) {
    this.config = config;
  }

  private async acquireLock(): Promise<void> {
    while (this.locked) {
      await this.lockPromise;
    }
    this.locked = true;
    this.lockPromise = new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  private releaseLock(): void {
    this.locked = false;
    this.lockPromise = null;
  }

  async canSpend(amount: number): Promise<boolean> {
    await this.acquireLock();
    try {
      const wouldSpend = this.spent + amount;
      const canAfford = wouldSpend <= this.config.maxBudgetUSDC;
      const notBlocked = this.getStateUnsafe() !== 'BUDGET_BLOCKED';
      return canAfford && notBlocked;
    } finally {
      this.releaseLock();
    }
  }

  async recordSpend(amount: number): Promise<boolean> {
    await this.acquireLock();
    try {
      const currentState = this.getStateUnsafe();
      
      // Prevent spending when blocked
      if (currentState === 'BUDGET_BLOCKED') {
        return false;
      }

      const wouldSpend = this.spent + amount;
      
      // Prevent overspending
      if (wouldSpend > this.config.maxBudgetUSDC) {
        return false;
      }

      this.spent = wouldSpend;
      this.lastUpdated = new Date();

      // Check if we need to transition to blocked state
      const newState = this.getStateUnsafe();
      if (newState === 'BUDGET_BLOCKED' && this.config.autoBlockEnabled) {
        console.warn('[BudgetEnforcer] Auto-blocking due to budget exhaustion');
      }

      return true;
    } finally {
      this.releaseLock();
    }
  }

  private getStateUnsafe(): BudgetState {
    const percentUsed = (this.spent / this.config.maxBudgetUSDC) * 100;

    if (percentUsed >= 100) {
      return 'BUDGET_BLOCKED';
    }
    if (percentUsed >= this.config.criticalThresholdPercent) {
      return 'CRITICAL';
    }
    if (percentUsed >= this.config.warningThresholdPercent) {
      return 'WARNING';
    }
    return 'HEALTHY';
  }

  async getStatus(): Promise<BudgetStatus> {
    await this.acquireLock();
    try {
      const state = this.getStateUnsafe();
      return {
        spent: this.spent,
        remaining: Math.max(0, this.config.maxBudgetUSDC - this.spent),
        percentUsed: (this.spent / this.config.maxBudgetUSDC) * 100,
        state,
        isBlocked: state === 'BUDGET_BLOCKED',
        lastUpdated: this.lastUpdated,
      };
    } finally {
      this.releaseLock();
    }
  }

  async reset(): Promise<void> {
    await this.acquireLock();
    try {
      this.spent = 0;
      this.lastUpdated = new Date();
    } finally {
      this.releaseLock();
    }
  }

  async setSpent(amount: number): Promise<void> {
    await this.acquireLock();
    try {
      if (amount < 0) {
        throw new Error('Spent amount cannot be negative');
      }
      this.spent = amount;
      this.lastUpdated = new Date();
    } finally {
      this.releaseLock();
    }
  }

  getConfig(): BudgetConfig {
    return { ...this.config };
  }
}

export const globalBudgetEnforcer = new BudgetEnforcer();
