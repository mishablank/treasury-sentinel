import { v4 as uuidv4 } from 'uuid';
import {
  PaymentRequest,
  PaymentProof,
  SettlementResult,
  Http402Response,
  PaymentHandlerConfig,
  PaymentVerificationParams,
  USDC_DECIMALS,
  BASE_USDC_ADDRESS,
} from './types';

export class Http402Handler {
  private config: PaymentHandlerConfig;
  private pendingPayments: Map<string, PaymentRequest> = new Map();

  constructor(config: Partial<PaymentHandlerConfig> = {}) {
    this.config = {
      baseRpcUrl: config.baseRpcUrl || process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      usdcContractAddress: config.usdcContractAddress || BASE_USDC_ADDRESS,
      recipientAddress: config.recipientAddress || process.env.PAYMENT_RECIPIENT_ADDRESS || '',
      confirmationBlocks: config.confirmationBlocks || 3,
      verificationTimeoutMs: config.verificationTimeoutMs || 60000,
    };
  }

  createPaymentRequest(endpoint: string, amountUSDC: number): Http402Response {
    const requestId = uuidv4();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const paymentRequest: PaymentRequest = {
      requestId,
      endpoint,
      requiredAmount: amountUSDC,
      currency: 'USDC',
      chain: 'base',
      recipientAddress: this.config.recipientAddress,
      expiresAt,
      metadata: {
        createdAt: new Date().toISOString(),
      },
    };

    this.pendingPayments.set(requestId, paymentRequest);

    return {
      status: 402,
      paymentRequired: paymentRequest,
      message: `Payment of ${amountUSDC} USDC required. Send to ${this.config.recipientAddress} on Base chain.`,
    };
  }

  async verifySettlement(params: PaymentVerificationParams): Promise<SettlementResult> {
    try {
      const txReceipt = await this.fetchTransactionReceipt(params.transactionHash);
      
      if (!txReceipt) {
        return {
          verified: false,
          error: 'Transaction not found',
        };
      }

      if (txReceipt.status !== '0x1') {
        return {
          verified: false,
          error: 'Transaction failed',
        };
      }

      const transferEvent = this.parseUSDCTransfer(txReceipt.logs);
      
      if (!transferEvent) {
        return {
          verified: false,
          error: 'No USDC transfer found in transaction',
        };
      }

      if (transferEvent.to.toLowerCase() !== params.expectedRecipient.toLowerCase()) {
        return {
          verified: false,
          error: 'Payment sent to wrong recipient',
        };
      }

      const amountReceived = this.parseUSDCAmount(transferEvent.value);
      
      if (amountReceived < params.expectedAmount) {
        return {
          verified: false,
          error: `Insufficient payment: expected ${params.expectedAmount}, received ${amountReceived}`,
        };
      }

      const blockInfo = await this.fetchBlockInfo(txReceipt.blockNumber);

      const paymentProof: PaymentProof = {
        transactionHash: params.transactionHash,
        chain: 'base',
        fromAddress: transferEvent.from,
        toAddress: transferEvent.to,
        amount: amountReceived,
        currency: 'USDC',
        blockNumber: parseInt(txReceipt.blockNumber, 16),
        timestamp: new Date(parseInt(blockInfo.timestamp, 16) * 1000),
      };

      return {
        verified: true,
        paymentProof,
        verifiedAt: new Date(),
      };
    } catch (error) {
      return {
        verified: false,
        error: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async waitForSettlement(
    transactionHash: string,
    expectedAmount: number
  ): Promise<SettlementResult> {
    const startTime = Date.now();
    const pollInterval = 3000;

    while (Date.now() - startTime < this.config.verificationTimeoutMs) {
      const result = await this.verifySettlement({
        transactionHash,
        expectedAmount,
        expectedRecipient: this.config.recipientAddress,
      });

      if (result.verified) {
        return result;
      }

      if (result.error && !result.error.includes('not found')) {
        return result;
      }

      await this.delay(pollInterval);
    }

    return {
      verified: false,
      error: 'Settlement verification timed out',
    };
  }

  getPendingPayment(requestId: string): PaymentRequest | undefined {
    return this.pendingPayments.get(requestId);
  }

  removePendingPayment(requestId: string): boolean {
    return this.pendingPayments.delete(requestId);
  }

  cleanupExpiredPayments(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [requestId, payment] of this.pendingPayments) {
      if (payment.expiresAt < now) {
        this.pendingPayments.delete(requestId);
        cleaned++;
      }
    }

    return cleaned;
  }

  private async fetchTransactionReceipt(txHash: string): Promise<TransactionReceipt | null> {
    const response = await fetch(this.config.baseRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txHash],
        id: 1,
      }),
    });

    const data = await response.json();
    return data.result;
  }

  private async fetchBlockInfo(blockNumber: string): Promise<BlockInfo> {
    const response = await fetch(this.config.baseRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBlockByNumber',
        params: [blockNumber, false],
        id: 1,
      }),
    });

    const data = await response.json();
    return data.result;
  }

  private parseUSDCTransfer(logs: TransactionLog[]): USDCTransfer | null {
    // ERC-20 Transfer event signature
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    for (const log of logs) {
      if (
        log.address.toLowerCase() === this.config.usdcContractAddress.toLowerCase() &&
        log.topics[0] === transferTopic
      ) {
        return {
          from: '0x' + log.topics[1].slice(26),
          to: '0x' + log.topics[2].slice(26),
          value: log.data,
        };
      }
    }

    return null;
  }

  private parseUSDCAmount(hexValue: string): number {
    const rawAmount = BigInt(hexValue);
    return Number(rawAmount) / Math.pow(10, USDC_DECIMALS);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface TransactionReceipt {
  transactionHash: string;
  blockNumber: string;
  status: string;
  logs: TransactionLog[];
}

interface TransactionLog {
  address: string;
  topics: string[];
  data: string;
}

interface BlockInfo {
  timestamp: string;
  number: string;
}

interface USDCTransfer {
  from: string;
  to: string;
  value: string;
}
