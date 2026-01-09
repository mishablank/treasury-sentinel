/**
 * Kaiko Metering Gateway Service
 * Handles HTTP 402 payment-required flows with Base USDC settlement verification
 */

import {
  KaikoConfig,
  KaikoPaymentRequired,
  KaikoPaymentReceipt,
  KaikoMarketDataRequest,
  KaikoResponse,
  KaikoBudgetStatus,
  KaikoSpotPriceResponse,
  KaikoOrderBookResponse,
  KaikoLiquidityDepthResponse,
  KaikoDataType,
} from '../../types/kaiko';

const DEFAULT_BUDGET_LIMIT_USDC = 10;
const BASE_CHAIN_ID = 8453;
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export class KaikoGateway {
  private config: KaikoConfig;
  private budget: KaikoBudgetStatus;
  private pendingPayments: Map<string, KaikoPaymentRequired>;
  private completedPayments: KaikoPaymentReceipt[];

  constructor(config: Partial<KaikoConfig> = {}) {
    this.config = {
      apiBaseUrl: config.apiBaseUrl || 'https://api.kaiko.io/v2',
      apiKey: config.apiKey || '',
      budgetLimitUsdc: config.budgetLimitUsdc || DEFAULT_BUDGET_LIMIT_USDC,
      settlementChainId: config.settlementChainId || BASE_CHAIN_ID,
      settlementTokenAddress: config.settlementTokenAddress || BASE_USDC_ADDRESS,
      paymentWalletAddress: config.paymentWalletAddress || '',
    };

    this.budget = {
      totalBudgetUsdc: this.config.budgetLimitUsdc,
      spentUsdc: 0,
      remainingUsdc: this.config.budgetLimitUsdc,
      isBlocked: false,
      paymentCount: 0,
    };

    this.pendingPayments = new Map();
    this.completedPayments = [];
  }

  /**
   * Check if budget allows for a payment of given amount
   */
  canAfford(amountUsdc: number): boolean {
    return !this.budget.isBlocked && this.budget.remainingUsdc >= amountUsdc;
  }

  /**
   * Get current budget status
   */
  getBudgetStatus(): KaikoBudgetStatus {
    return { ...this.budget };
  }

  /**
   * Fetch spot price data with automatic 402 handling
   */
  async fetchSpotPrice(
    instrument: string,
    exchange?: string
  ): Promise<KaikoResponse<KaikoSpotPriceResponse>> {
    return this.makeDataRequest<KaikoSpotPriceResponse>({
      instrument,
      exchange,
      dataType: 'spot_price',
    });
  }

  /**
   * Fetch order book data with automatic 402 handling
   */
  async fetchOrderBook(
    instrument: string,
    exchange?: string
  ): Promise<KaikoResponse<KaikoOrderBookResponse>> {
    return this.makeDataRequest<KaikoOrderBookResponse>({
      instrument,
      exchange,
      dataType: 'order_book',
    });
  }

  /**
   * Fetch liquidity depth analysis with automatic 402 handling
   */
  async fetchLiquidityDepth(
    instrument: string,
    exchange?: string
  ): Promise<KaikoResponse<KaikoLiquidityDepthResponse>> {
    return this.makeDataRequest<KaikoLiquidityDepthResponse>({
      instrument,
      exchange,
      dataType: 'liquidity_depth',
    });
  }

  /**
   * Generic data request with HTTP 402 payment handling
   */
  private async makeDataRequest<T>(
    request: KaikoMarketDataRequest
  ): Promise<KaikoResponse<T>> {
    if (this.budget.isBlocked) {
      return {
        success: false,
        error: 'Budget blocked - 10 USDC limit reached',
        budgetBlocked: true,
      };
    }

    try {
      const response = await this.executeApiCall<T>(request);
      return response;
    } catch (error) {
      if (this.isPaymentRequiredError(error)) {
        return this.handlePaymentRequired(error as KaikoPaymentRequired);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute the actual API call (mock implementation for now)
   */
  private async executeApiCall<T>(
    request: KaikoMarketDataRequest
  ): Promise<KaikoResponse<T>> {
    const endpoint = this.buildEndpoint(request);
    const estimatedCost = this.estimateCost(request.dataType);

    // Simulate API call - in production this would be actual fetch
    // For now, simulate successful response for basic requests
    if (this.canAfford(estimatedCost)) {
      const mockData = this.generateMockData<T>(request);
      this.recordSpend(estimatedCost);
      return {
        success: true,
        data: mockData,
        cost: estimatedCost,
      };
    }

    // Simulate 402 response when budget is tight
    throw this.create402Response(estimatedCost, endpoint);
  }

  /**
   * Build API endpoint URL
   */
  private buildEndpoint(request: KaikoMarketDataRequest): string {
    const { instrument, exchange, dataType } = request;
    // Encode URL path segments to prevent injection attacks
    let path = `/${dataType}/${encodeURIComponent(instrument)}`;
    if (exchange) {
      path += `?exchange=${encodeURIComponent(exchange)}`;
    }
    return `${this.config.apiBaseUrl}${path}`;
  }

  /**
   * Estimate cost for a data type request
   */
  private estimateCost(dataType: KaikoDataType): number {
    const costs: Record<KaikoDataType, number> = {
      spot_price: 0.01,
      ohlcv: 0.02,
      vwap: 0.02,
      trades: 0.05,
      order_book: 0.1,
      liquidity_depth: 0.25,
    };
    return costs[dataType] || 0.05;
  }

  /**
   * Check if error is a 402 Payment Required
   */
  private isPaymentRequiredError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      (error as { statusCode: number }).statusCode === 402
    );
  }

  /**
   * Handle HTTP 402 Payment Required response
   */
  private handlePaymentRequired<T>(
    paymentRequired: KaikoPaymentRequired
  ): KaikoResponse<T> {
    this.pendingPayments.set(paymentRequired.invoiceId, paymentRequired);

    if (!this.canAfford(paymentRequired.requiredAmountUsdc)) {
      this.budget.isBlocked = true;
      return {
        success: false,
        error: 'Insufficient budget for required payment',
        budgetBlocked: true,
      };
    }

    return {
      success: false,
      paymentRequired,
    };
  }

  /**
   * Create a 402 response for simulation
   */
  private create402Response(
    amount: number,
    endpoint: string
  ): KaikoPaymentRequired {
    return {
      statusCode: 402,
      requiredAmountUsdc: amount,
      paymentAddress: this.config.paymentWalletAddress,
      invoiceId: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      dataEndpoint: endpoint,
    };
  }

  /**
   * Record a spend against the budget
   */
  private recordSpend(amountUsdc: number): void {
    this.budget.spentUsdc += amountUsdc;
    this.budget.remainingUsdc = this.budget.totalBudgetUsdc - this.budget.spentUsdc;
    this.budget.paymentCount++;
    this.budget.lastPaymentAt = new Date();

    if (this.budget.remainingUsdc <= 0) {
      this.budget.isBlocked = true;
    }
  }

  /**
   * Submit payment for a pending invoice
   */
  async submitPayment(
    invoiceId: string,
    transactionHash: string
  ): Promise<{ success: boolean; error?: string }> {
    const pending = this.pendingPayments.get(invoiceId);
    if (!pending) {
      return { success: false, error: 'Invoice not found' };
    }

    if (new Date() > pending.expiresAt) {
      this.pendingPayments.delete(invoiceId);
      return { success: false, error: 'Invoice expired' };
    }

    // Verify payment on Base chain (mock for now)
    const verified = await this.verifyOnChainPayment(
      transactionHash,
      pending.requiredAmountUsdc
    );

    if (!verified) {
      return { success: false, error: 'Payment verification failed' };
    }

    const receipt: KaikoPaymentReceipt = {
      invoiceId,
      transactionHash,
      amountUsdc: pending.requiredAmountUsdc,
      paidAt: new Date(),
      settledOnChain: this.config.settlementChainId,
      verified: true,
    };

    this.completedPayments.push(receipt);
    this.pendingPayments.delete(invoiceId);
    this.recordSpend(pending.requiredAmountUsdc);

    return { success: true };
  }

  /**
   * Verify payment transaction on Base chain
   */
  private async verifyOnChainPayment(
    _transactionHash: string,
    _expectedAmount: number
  ): Promise<boolean> {
    // In production, this would:
    // 1. Query Base chain for the transaction
    // 2. Verify it's a USDC transfer to the correct address
    // 3. Verify the amount matches
    // 4. Ensure sufficient confirmations
    return true;
  }

  /**
   * Generate mock data for testing (to be replaced with real API calls)
   */
  private generateMockData<T>(request: KaikoMarketDataRequest): T {
    const now = new Date();

    switch (request.dataType) {
      case 'spot_price':
        return {
          instrument: request.instrument,
          exchange: request.exchange || 'aggregate',
          price: 1850.0 + Math.random() * 100,
          volume24h: 1000000 + Math.random() * 500000,
          timestamp: now,
          confidence: 0.95 + Math.random() * 0.05,
        } as T;

      case 'order_book':
        return {
          instrument: request.instrument,
          exchange: request.exchange || 'aggregate',
          bids: this.generateOrderBookLevels(1850, 'bid'),
          asks: this.generateOrderBookLevels(1850, 'ask'),
          timestamp: now,
          depth: 10,
        } as T;

      case 'liquidity_depth':
        return {
          instrument: request.instrument,
          exchange: request.exchange || 'aggregate',
          depthBands: this.generateDepthBands(),
          impactCurve: this.generateImpactCurve(),
          timestamp: now,
        } as T;

      default:
        return {} as T;
    }
  }

  private generateOrderBookLevels(
    midPrice: number,
    side: 'bid' | 'ask'
  ): Array<{ price: number; quantity: number; cumulativeQuantity: number }> {
    const levels = [];
    let cumulative = 0;
    for (let i = 0; i < 10; i++) {
      const offset = (i + 1) * 0.5;
      const price = side === 'bid' ? midPrice - offset : midPrice + offset;
      const quantity = 10 + Math.random() * 50;
      cumulative += quantity;
      levels.push({ price, quantity, cumulativeQuantity: cumulative });
    }
    return levels;
  }

  private generateDepthBands(): Array<{
    percentFromMid: number;
    bidDepthUsd: number;
    askDepthUsd: number;
    totalDepthUsd: number;
  }> {
    return [0.1, 0.25, 0.5, 1.0, 2.0, 5.0].map((percent) => {
      const bidDepth = 100000 * percent * (0.8 + Math.random() * 0.4);
      const askDepth = 100000 * percent * (0.8 + Math.random() * 0.4);
      return {
        percentFromMid: percent,
        bidDepthUsd: bidDepth,
        askDepthUsd: askDepth,
        totalDepthUsd: bidDepth + askDepth,
      };
    });
  }

  private generateImpactCurve(): Array<{
    sizeUsd: number;
    priceImpactBps: number;
    side: 'buy' | 'sell';
  }> {
    const sizes = [10000, 50000, 100000, 500000, 1000000];
    const curve: Array<{ sizeUsd: number; priceImpactBps: number; side: 'buy' | 'sell' }> = [];

    for (const size of sizes) {
      curve.push({
        sizeUsd: size,
        priceImpactBps: Math.sqrt(size / 1000) * (1 + Math.random() * 0.2),
        side: 'buy',
      });
      curve.push({
        sizeUsd: size,
        priceImpactBps: Math.sqrt(size / 1000) * (1 + Math.random() * 0.2),
        side: 'sell',
      });
    }

    return curve;
  }

  /**
   * Get payment history
   */
  getPaymentHistory(): KaikoPaymentReceipt[] {
    return [...this.completedPayments];
  }

  /**
   * Get pending payments
   */
  getPendingPayments(): KaikoPaymentRequired[] {
    return Array.from(this.pendingPayments.values());
  }

  /**
   * Reset budget (for testing/demo purposes)
   */
  resetBudget(): void {
    this.budget = {
      totalBudgetUsdc: this.config.budgetLimitUsdc,
      spentUsdc: 0,
      remainingUsdc: this.config.budgetLimitUsdc,
      isBlocked: false,
      paymentCount: 0,
    };
    this.completedPayments = [];
    this.pendingPayments.clear();
  }
}
