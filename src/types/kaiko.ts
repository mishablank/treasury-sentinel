/**
 * Kaiko Metering Gateway Types
 * HTTP 402 payment-required enforcement with Base USDC settlement
 */

export interface KaikoConfig {
  apiBaseUrl: string;
  apiKey: string;
  budgetLimitUsdc: number;
  settlementChainId: number; // Base chain ID (8453)
  settlementTokenAddress: string; // USDC on Base
  paymentWalletAddress: string;
}

export interface KaikoPaymentRequired {
  statusCode: 402;
  requiredAmountUsdc: number;
  paymentAddress: string;
  invoiceId: string;
  expiresAt: Date;
  dataEndpoint: string;
}

export interface KaikoPaymentReceipt {
  invoiceId: string;
  transactionHash: string;
  amountUsdc: number;
  paidAt: Date;
  settledOnChain: number;
  verified: boolean;
}

export interface KaikoMarketDataRequest {
  instrument: string;
  exchange?: string;
  dataType: KaikoDataType;
  startTime?: Date;
  endTime?: Date;
  interval?: string;
}

export type KaikoDataType =
  | 'spot_price'
  | 'order_book'
  | 'trades'
  | 'ohlcv'
  | 'vwap'
  | 'liquidity_depth';

export interface KaikoSpotPriceResponse {
  instrument: string;
  exchange: string;
  price: number;
  volume24h: number;
  timestamp: Date;
  confidence: number;
}

export interface KaikoOrderBookResponse {
  instrument: string;
  exchange: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: Date;
  depth: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  cumulativeQuantity: number;
}

export interface KaikoLiquidityDepthResponse {
  instrument: string;
  exchange: string;
  depthBands: DepthBand[];
  impactCurve: ImpactPoint[];
  timestamp: Date;
}

export interface DepthBand {
  percentFromMid: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  totalDepthUsd: number;
}

export interface ImpactPoint {
  sizeUsd: number;
  priceImpactBps: number;
  side: 'buy' | 'sell';
}

export interface KaikoBudgetStatus {
  totalBudgetUsdc: number;
  spentUsdc: number;
  remainingUsdc: number;
  isBlocked: boolean;
  lastPaymentAt?: Date;
  paymentCount: number;
}

export interface KaikoGatewayState {
  config: KaikoConfig;
  budget: KaikoBudgetStatus;
  pendingPayments: Map<string, KaikoPaymentRequired>;
  completedPayments: KaikoPaymentReceipt[];
}

export type KaikoResponse<T> =
  | { success: true; data: T; cost: number }
  | { success: false; paymentRequired: KaikoPaymentRequired }
  | { success: false; error: string; budgetBlocked?: boolean };
