/**
 * @module types/treasury
 * @description Core treasury monitoring types for multi-chain EVM treasury tracking
 */

/**
 * Supported blockchain networks for treasury monitoring
 * @description Currently supports Ethereum mainnet and major L2s
 */
export type ChainId = 1 | 100 | 42161 | 10 | 8453;

/**
 * Human-readable chain name mapping
 */
export type ChainName = 'ethereum' | 'gnosis' | 'arbitrum' | 'optimism' | 'base';

/**
 * Represents an ERC-20 token balance snapshot at a specific point in time
 * @interface TokenBalance
 * @property {string} token - ERC-20 token contract address (checksummed)
 * @property {string} symbol - Token symbol (e.g., 'USDC', 'ETH')
 * @property {bigint} balance - Raw token balance (in smallest unit)
 * @property {number} decimals - Token decimals for conversion
 * @property {number} usdValue - USD value at snapshot time
 */
export interface TokenBalance {
  /** ERC-20 token contract address (checksummed) */
  token: string;
  /** Token symbol (e.g., 'USDC', 'ETH') */
  symbol: string;
  /** Raw token balance (in smallest unit) */
  balance: bigint;
  /** Token decimals for conversion */
  decimals: number;
  /** USD value at snapshot time */
  usdValue: number;
}

/**
 * Complete treasury snapshot capturing state at a moment in time
 * @interface TreasurySnapshot
 * @example
 * ```typescript
 * const snapshot: TreasurySnapshot = {
 *   chainId: 1,
 *   chainName: 'ethereum',
 *   address: '0x...',
 *   balances: [...],
 *   totalUsdValue: 1000000,
 *   timestamp: Date.now(),
 *   blockNumber: 18000000
 * };
 * ```
 */
export interface TreasurySnapshot {
  /** Numeric chain identifier */
  chainId: ChainId;
  /** Human-readable chain name */
  chainName: ChainName;
  /** Treasury contract address (checksummed) */
  address: string;
  /** Array of token balances in this treasury */
  balances: TokenBalance[];
  /** Total USD value of all holdings */
  totalUsdValue: number;
  /** Unix timestamp (milliseconds) of snapshot */
  timestamp: number;
  /** Block number at snapshot time */
  blockNumber: number;
}

/**
 * Aggregated view across all monitored treasuries
 * @interface AggregatedTreasury
 */
export interface AggregatedTreasury {
  /** Individual chain snapshots */
  snapshots: TreasurySnapshot[];
  /** Combined USD value across all chains */
  totalUsdValue: number;
  /** Timestamp of aggregation */
  timestamp: number;
  /** Total unique tokens across all chains */
  uniqueTokenCount: number;
}

/**
 * Configuration for a treasury address to monitor
 * @interface TreasuryConfig
 */
export interface TreasuryConfig {
  /** Treasury contract address */
  address: string;
  /** Target chain for monitoring */
  chainId: ChainId;
  /** Optional human-readable label */
  label?: string;
  /** Token addresses to specifically track (empty = all) */
  trackedTokens?: string[];
}

/**
 * Treasury monitoring alert configuration
 * @interface TreasuryAlert
 */
export interface TreasuryAlert {
  /** Unique alert identifier */
  id: string;
  /** Alert severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Alert type classification */
  type: 'balance_drop' | 'unusual_transfer' | 'low_liquidity' | 'price_impact';
  /** Human-readable alert message */
  message: string;
  /** Related treasury address */
  treasuryAddress: string;
  /** Chain where alert originated */
  chainId: ChainId;
  /** Alert creation timestamp */
  timestamp: number;
  /** Whether alert has been acknowledged */
  acknowledged: boolean;
  /** Additional context data */
  metadata?: Record<string, unknown>;
}
