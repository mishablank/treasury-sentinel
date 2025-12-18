export interface SettlementConfig {
  baseRpcUrl: string;
  usdcContractAddress: string;
  receiverAddress: string;
  confirmationBlocks: number;
  timeoutMs: number;
}

export interface TransferEvent {
  transactionHash: string;
  blockNumber: number;
  from: string;
  to: string;
  amount: bigint;
  timestamp: number;
}

export interface SettlementVerification {
  transactionHash: string;
  verified: boolean;
  amount: bigint;
  sender: string;
  blockNumber: number;
  confirmations: number;
  timestamp: number;
  error?: string;
}

export interface PendingSettlement {
  id: string;
  expectedAmount: bigint;
  expectedSender: string;
  paymentId: string;
  createdAt: number;
  expiresAt: number;
  status: SettlementStatus;
  verification?: SettlementVerification;
}

export type SettlementStatus = 
  | 'PENDING'
  | 'DETECTED'
  | 'CONFIRMING'
  | 'VERIFIED'
  | 'EXPIRED'
  | 'FAILED';

export interface SettlementResult {
  success: boolean;
  settlementId: string;
  status: SettlementStatus;
  verification?: SettlementVerification;
  error?: string;
}

export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const BASE_CHAIN_ID = 8453;

export const DEFAULT_SETTLEMENT_CONFIG: Partial<SettlementConfig> = {
  usdcContractAddress: BASE_USDC_ADDRESS,
  confirmationBlocks: 3,
  timeoutMs: 120000, // 2 minutes
};
