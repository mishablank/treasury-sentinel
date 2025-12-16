export interface PaymentRequest {
  requestId: string;
  endpoint: string;
  requiredAmount: number;
  currency: 'USDC';
  chain: 'base';
  recipientAddress: string;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

export interface PaymentProof {
  transactionHash: string;
  chain: 'base';
  fromAddress: string;
  toAddress: string;
  amount: number;
  currency: 'USDC';
  blockNumber: number;
  timestamp: Date;
}

export interface SettlementResult {
  verified: boolean;
  paymentProof?: PaymentProof;
  error?: string;
  verifiedAt?: Date;
}

export interface Http402Response {
  status: 402;
  paymentRequired: PaymentRequest;
  message: string;
}

export interface PaymentHandlerConfig {
  baseRpcUrl: string;
  usdcContractAddress: string;
  recipientAddress: string;
  confirmationBlocks: number;
  verificationTimeoutMs: number;
}

export interface PaymentVerificationParams {
  transactionHash: string;
  expectedAmount: number;
  expectedRecipient: string;
}

export const USDC_DECIMALS = 6;
export const BASE_CHAIN_ID = 8453;
export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
