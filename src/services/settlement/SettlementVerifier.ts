import {
  SettlementConfig,
  SettlementVerification,
  PendingSettlement,
  SettlementResult,
  SettlementStatus,
  TransferEvent,
  DEFAULT_SETTLEMENT_CONFIG,
  BASE_CHAIN_ID,
} from './types';
import { v4 as uuidv4 } from 'uuid';

// USDC Transfer event signature
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export class SettlementVerifier {
  private config: SettlementConfig;
  private pendingSettlements: Map<string, PendingSettlement> = new Map();
  private verifiedTransactions: Set<string> = new Set();

  constructor(config: Partial<SettlementConfig> & { baseRpcUrl: string; receiverAddress: string }) {
    this.config = {
      ...DEFAULT_SETTLEMENT_CONFIG,
      ...config,
    } as SettlementConfig;
  }

  async createPendingSettlement(
    expectedAmount: bigint,
    expectedSender: string,
    paymentId: string,
    timeoutMs?: number
  ): Promise<PendingSettlement> {
    const id = uuidv4();
    const now = Date.now();
    const timeout = timeoutMs ?? this.config.timeoutMs;

    const pending: PendingSettlement = {
      id,
      expectedAmount,
      expectedSender: expectedSender.toLowerCase(),
      paymentId,
      createdAt: now,
      expiresAt: now + timeout,
      status: 'PENDING',
    };

    this.pendingSettlements.set(id, pending);
    return pending;
  }

  async verifyTransaction(transactionHash: string): Promise<SettlementVerification> {
    try {
      // Get transaction receipt
      const receipt = await this.getTransactionReceipt(transactionHash);
      
      if (!receipt) {
        return {
          transactionHash,
          verified: false,
          amount: BigInt(0),
          sender: '',
          blockNumber: 0,
          confirmations: 0,
          timestamp: Date.now(),
          error: 'Transaction not found',
        };
      }

      // Parse transfer events
      const transfers = this.parseTransferEvents(receipt.logs);
      
      // Find USDC transfer to our receiver
      const relevantTransfer = transfers.find(
        t => t.to.toLowerCase() === this.config.receiverAddress.toLowerCase()
      );

      if (!relevantTransfer) {
        return {
          transactionHash,
          verified: false,
          amount: BigInt(0),
          sender: '',
          blockNumber: receipt.blockNumber,
          confirmations: 0,
          timestamp: Date.now(),
          error: 'No USDC transfer to receiver found',
        };
      }

      // Get current block for confirmations
      const currentBlock = await this.getCurrentBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;

      const verified = confirmations >= this.config.confirmationBlocks;

      return {
        transactionHash,
        verified,
        amount: relevantTransfer.amount,
        sender: relevantTransfer.from,
        blockNumber: receipt.blockNumber,
        confirmations,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        transactionHash,
        verified: false,
        amount: BigInt(0),
        sender: '',
        blockNumber: 0,
        confirmations: 0,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  async verifyPendingSettlement(
    settlementId: string,
    transactionHash: string
  ): Promise<SettlementResult> {
    const pending = this.pendingSettlements.get(settlementId);
    
    if (!pending) {
      return {
        success: false,
        settlementId,
        status: 'FAILED',
        error: 'Settlement not found',
      };
    }

    // Check if expired
    if (Date.now() > pending.expiresAt) {
      pending.status = 'EXPIRED';
      return {
        success: false,
        settlementId,
        status: 'EXPIRED',
        error: 'Settlement expired',
      };
    }

    // Check if transaction already used
    if (this.verifiedTransactions.has(transactionHash)) {
      return {
        success: false,
        settlementId,
        status: 'FAILED',
        error: 'Transaction already used for another settlement',
      };
    }

    pending.status = 'DETECTING';
    
    const verification = await this.verifyTransaction(transactionHash);

    if (!verification.verified) {
      if (verification.confirmations > 0) {
        pending.status = 'CONFIRMING';
      }
      return {
        success: false,
        settlementId,
        status: pending.status,
        verification,
        error: verification.error ?? 'Awaiting confirmations',
      };
    }

    // Verify amount matches
    if (verification.amount < pending.expectedAmount) {
      pending.status = 'FAILED';
      return {
        success: false,
        settlementId,
        status: 'FAILED',
        verification,
        error: `Insufficient amount: expected ${pending.expectedAmount}, got ${verification.amount}`,
      };
    }

    // Verify sender matches (if specified)
    if (
      pending.expectedSender &&
      verification.sender.toLowerCase() !== pending.expectedSender.toLowerCase()
    ) {
      pending.status = 'FAILED';
      return {
        success: false,
        settlementId,
        status: 'FAILED',
        verification,
        error: `Sender mismatch: expected ${pending.expectedSender}, got ${verification.sender}`,
      };
    }

    // Mark as verified
    pending.status = 'VERIFIED';
    pending.verification = verification;
    this.verifiedTransactions.add(transactionHash);

    return {
      success: true,
      settlementId,
      status: 'VERIFIED',
      verification,
    };
  }

  async pollForSettlement(
    settlementId: string,
    pollIntervalMs: number = 5000
  ): Promise<SettlementResult> {
    const pending = this.pendingSettlements.get(settlementId);
    
    if (!pending) {
      return {
        success: false,
        settlementId,
        status: 'FAILED',
        error: 'Settlement not found',
      };
    }

    while (Date.now() < pending.expiresAt) {
      // Query recent transfer events
      const transfers = await this.queryRecentTransfers();
      
      // Find matching transfer
      const matchingTransfer = transfers.find(
        t =>
          t.to.toLowerCase() === this.config.receiverAddress.toLowerCase() &&
          t.amount >= pending.expectedAmount &&
          (!pending.expectedSender ||
            t.from.toLowerCase() === pending.expectedSender.toLowerCase()) &&
          !this.verifiedTransactions.has(t.transactionHash)
      );

      if (matchingTransfer) {
        return this.verifyPendingSettlement(settlementId, matchingTransfer.transactionHash);
      }

      // Wait before next poll
      await this.sleep(pollIntervalMs);
    }

    pending.status = 'EXPIRED';
    return {
      success: false,
      settlementId,
      status: 'EXPIRED',
      error: 'Settlement timeout',
    };
  }

  getPendingSettlement(settlementId: string): PendingSettlement | undefined {
    return this.pendingSettlements.get(settlementId);
  }

  cancelPendingSettlement(settlementId: string): boolean {
    return this.pendingSettlements.delete(settlementId);
  }

  cleanupExpiredSettlements(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, settlement] of this.pendingSettlements) {
      if (now > settlement.expiresAt && settlement.status !== 'VERIFIED') {
        this.pendingSettlements.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  private async getTransactionReceipt(hash: string): Promise<any> {
    const response = await fetch(this.config.baseRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [hash],
        id: 1,
      }),
    });

    const data = await response.json();
    return data.result;
  }

  private async getCurrentBlockNumber(): Promise<number> {
    const response = await fetch(this.config.baseRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
    });

    const data = await response.json();
    return parseInt(data.result, 16);
  }

  private async queryRecentTransfers(): Promise<TransferEvent[]> {
    const currentBlock = await this.getCurrentBlockNumber();
    const fromBlock = currentBlock - 50; // Last ~50 blocks

    const response = await fetch(this.config.baseRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [
          {
            address: this.config.usdcContractAddress,
            topics: [
              TRANSFER_EVENT_SIGNATURE,
              null,
              this.padAddress(this.config.receiverAddress),
            ],
            fromBlock: '0x' + fromBlock.toString(16),
            toBlock: 'latest',
          },
        ],
        id: 1,
      }),
    });

    const data = await response.json();
    return this.parseTransferEvents(data.result ?? []);
  }

  private parseTransferEvents(logs: any[]): TransferEvent[] {
    return logs
      .filter(
        (log: any) =>
          log.address.toLowerCase() === this.config.usdcContractAddress.toLowerCase() &&
          log.topics[0] === TRANSFER_EVENT_SIGNATURE
      )
      .map((log: any) => ({
        transactionHash: log.transactionHash,
        blockNumber: parseInt(log.blockNumber, 16),
        from: '0x' + log.topics[1].slice(26),
        to: '0x' + log.topics[2].slice(26),
        amount: BigInt(log.data),
        timestamp: Date.now(),
      }));
  }

  private padAddress(address: string): string {
    return '0x' + address.slice(2).toLowerCase().padStart(64, '0');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
