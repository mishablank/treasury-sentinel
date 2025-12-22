/**
 * Validation utilities for treasury sentinel
 */

import { EscalationLevel } from '../types/escalation';
import { ChainId, SUPPORTED_CHAINS } from '../config/chains';
import { BUDGET_CONFIG } from '../config/budget';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateEscalationLevel(level: unknown): level is EscalationLevel {
  if (typeof level !== 'string') return false;
  const validLevels: EscalationLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
  return validLevels.includes(level as EscalationLevel);
}

export function validateChainId(chainId: unknown): chainId is ChainId {
  if (typeof chainId !== 'number') return false;
  return SUPPORTED_CHAINS.some(chain => chain.chainId === chainId);
}

export function validateAddress(address: unknown): address is string {
  if (typeof address !== 'string') return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function validateTransactionHash(hash: unknown): hash is string {
  if (typeof hash !== 'string') return false;
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

export function validatePositiveNumber(value: unknown): value is number {
  if (typeof value !== 'number') return false;
  return !isNaN(value) && value > 0 && isFinite(value);
}

export function validateNonNegativeNumber(value: unknown): value is number {
  if (typeof value !== 'number') return false;
  return !isNaN(value) && value >= 0 && isFinite(value);
}

export function validatePercentage(value: unknown): value is number {
  if (!validateNonNegativeNumber(value)) return false;
  return value >= 0 && value <= 100;
}

export function validateBudgetAmount(amount: number): ValidationResult {
  const errors: string[] = [];
  
  if (!validateNonNegativeNumber(amount)) {
    errors.push('Amount must be a non-negative number');
  }
  
  if (amount > BUDGET_CONFIG.maxBudgetUSDC) {
    errors.push(`Amount exceeds maximum budget of ${BUDGET_CONFIG.maxBudgetUSDC} USDC`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateDateRange(startDate: Date, endDate: Date): ValidationResult {
  const errors: string[] = [];
  
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    errors.push('Invalid start date');
  }
  
  if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
    errors.push('Invalid end date');
  }
  
  if (errors.length === 0 && startDate > endDate) {
    errors.push('Start date must be before end date');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateTokenSymbol(symbol: unknown): symbol is string {
  if (typeof symbol !== 'string') return false;
  return /^[A-Z0-9]{1,10}$/.test(symbol.toUpperCase());
}

export function validateUUID(uuid: unknown): uuid is string {
  if (typeof uuid !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

export function assertValid<T>(
  value: unknown,
  validator: (v: unknown) => v is T,
  errorMessage: string
): asserts value is T {
  if (!validator(value)) {
    throw new Error(errorMessage);
  }
}

export function createValidator<T>(
  validators: Array<(value: T) => string | null>
): (value: T) => ValidationResult {
  return (value: T) => {
    const errors = validators
      .map(v => v(value))
      .filter((error): error is string => error !== null);
    
    return {
      valid: errors.length === 0,
      errors
    };
  };
}
