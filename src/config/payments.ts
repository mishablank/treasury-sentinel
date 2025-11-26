/**
 * Payment Configuration
 * HTTP 402 payment flow and Base USDC settlement settings
 */

import { SupportedChainId } from './chains';

export interface PaymentConfig {
  settlementChainId: SupportedChainId;
  settlementTokenAddress: string;
  settlementTokenSymbol: string;
  settlementTokenDecimals: number;
  minPaymentAmountUSDC: number;
  maxPaymentAmountUSDC: number;
  paymentTimeoutMs: number;
  confirmationBlocks: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface HTTP402Config {
  enabled: boolean;
  acceptedPaymentMethods: PaymentMethod[];
  paymentReceiptHeader: string;
  paymentRequiredHeader: string;
  paymentAmountHeader: string;
  paymentAddressHeader: string;
}

export type PaymentMethod = 'base_usdc' | 'ethereum_usdc' | 'lightning';

export interface PaymentReceipt {
  transactionHash: string;
  chainId: SupportedChainId;
  fromAddress: string;
  toAddress: string;
  amountUSDC: number;
  timestamp: Date;
  blockNumber: number;
  confirmed: boolean;
}

export interface PaymentRequest {
  requestId: string;
  amountUSDC: number;
  recipientAddress: string;
  chainId: SupportedChainId;
  expiresAt: Date;
  description: string;
  metadata?: Record<string, unknown>;
}

// Base USDC contract address
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  settlementChainId: 8453, // Base mainnet
  settlementTokenAddress: BASE_USDC_ADDRESS,
  settlementTokenSymbol: 'USDC',
  settlementTokenDecimals: 6,
  minPaymentAmountUSDC: 0.001,
  maxPaymentAmountUSDC: 10,
  paymentTimeoutMs: 60000, // 1 minute
  confirmationBlocks: 1,
  retryAttempts: 3,
  retryDelayMs: 5000,
};

export const DEFAULT_HTTP402_CONFIG: HTTP402Config = {
  enabled: true,
  acceptedPaymentMethods: ['base_usdc'],
  paymentReceiptHeader: 'X-Payment-Receipt',
  paymentRequiredHeader: 'X-Payment-Required',
  paymentAmountHeader: 'X-Payment-Amount',
  paymentAddressHeader: 'X-Payment-Address',
};

export function createPaymentConfig(
  overrides?: Partial<PaymentConfig>
): PaymentConfig {
  return {
    ...DEFAULT_PAYMENT_CONFIG,
    ...overrides,
  };
}

export function createHTTP402Config(
  overrides?: Partial<HTTP402Config>
): HTTP402Config {
  return {
    ...DEFAULT_HTTP402_CONFIG,
    ...overrides,
  };
}

export function formatPaymentAmount(
  amountUSDC: number,
  config: PaymentConfig = DEFAULT_PAYMENT_CONFIG
): string {
  const atomicAmount = Math.round(
    amountUSDC * Math.pow(10, config.settlementTokenDecimals)
  );
  return atomicAmount.toString();
}

export function parsePaymentAmount(
  atomicAmount: string,
  config: PaymentConfig = DEFAULT_PAYMENT_CONFIG
): number {
  return parseInt(atomicAmount, 10) / Math.pow(10, config.settlementTokenDecimals);
}

export function validatePaymentAmount(
  amountUSDC: number,
  config: PaymentConfig = DEFAULT_PAYMENT_CONFIG
): { valid: boolean; error?: string } {
  if (amountUSDC < config.minPaymentAmountUSDC) {
    return {
      valid: false,
      error: `Amount ${amountUSDC} USDC is below minimum ${config.minPaymentAmountUSDC} USDC`,
    };
  }

  if (amountUSDC > config.maxPaymentAmountUSDC) {
    return {
      valid: false,
      error: `Amount ${amountUSDC} USDC exceeds maximum ${config.maxPaymentAmountUSDC} USDC`,
    };
  }

  return { valid: true };
}

export function isPaymentExpired(request: PaymentRequest): boolean {
  return new Date() > request.expiresAt;
}

export function createPaymentRequest(
  amountUSDC: number,
  recipientAddress: string,
  description: string,
  config: PaymentConfig = DEFAULT_PAYMENT_CONFIG
): PaymentRequest {
  const expiresAt = new Date(
    Date.now() + config.paymentTimeoutMs
  );

  return {
    requestId: generateRequestId(),
    amountUSDC,
    recipientAddress,
    chainId: config.settlementChainId,
    expiresAt,
    description,
  };
}

function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `pay_${timestamp}_${random}`;
}

export const paymentConfig = createPaymentConfig();
export const http402Config = createHTTP402Config();
