/**
 * Configuration module exports
 */

export * from './database';
export * from './scheduler';

/**
 * Main application configuration
 */
export interface AppConfig {
  /** Environment: development, staging, production */
  environment: 'development' | 'staging' | 'production';
  /** Demo budget limit in USDC */
  budgetLimitUsdc: number;
  /** Supported chain IDs */
  supportedChains: number[];
  /** API rate limits */
  rateLimits: RateLimitConfig;
}

export interface RateLimitConfig {
  /** Requests per minute per endpoint */
  requestsPerMinute: number;
  /** Burst limit */
  burstLimit: number;
}

export const SUPPORTED_CHAINS = {
  ETHEREUM: 1,
  GNOSIS: 100,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  BASE: 8453,
} as const;

export const defaultAppConfig: AppConfig = {
  environment: (process.env.NODE_ENV as AppConfig['environment']) || 'development',
  budgetLimitUsdc: 10.0, // Strict 10 USDC demo budget
  supportedChains: Object.values(SUPPORTED_CHAINS),
  rateLimits: {
    requestsPerMinute: 60,
    burstLimit: 10,
  },
};

/**
 * Chain configuration with RPC endpoints
 */
export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  [SUPPORTED_CHAINS.ETHEREUM]: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  [SUPPORTED_CHAINS.GNOSIS]: {
    chainId: 100,
    name: 'Gnosis Chain',
    rpcUrl: process.env.GNOSIS_RPC_URL || 'https://rpc.gnosischain.com',
    blockExplorer: 'https://gnosisscan.io',
    nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
  },
  [SUPPORTED_CHAINS.ARBITRUM]: {
    chainId: 42161,
    name: 'Arbitrum One',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  [SUPPORTED_CHAINS.OPTIMISM]: {
    chainId: 10,
    name: 'Optimism',
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  [SUPPORTED_CHAINS.BASE]: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
};
