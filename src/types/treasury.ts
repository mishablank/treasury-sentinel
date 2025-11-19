/**
 * Core treasury monitoring type definitions
 */

export type SupportedChain = 'ethereum' | 'gnosis' | 'arbitrum' | 'optimism' | 'base';

export interface ChainConfig {
  chainId: number;
  name: SupportedChain;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface ERC20Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chain: SupportedChain;
}

export interface TokenBalance {
  token: ERC20Token;
  balance: bigint;
  balanceFormatted: string;
  usdValue: number | null;
  timestamp: Date;
}

export interface TreasurySnapshot {
  id: string;
  chain: SupportedChain;
  treasuryAddress: string;
  balances: TokenBalance[];
  totalUsdValue: number | null;
  timestamp: Date;
  blockNumber: number;
}

export interface TreasuryConfig {
  address: string;
  chain: SupportedChain;
  name: string;
  tokens: string[]; // Token addresses to monitor
}

export interface MultiChainTreasury {
  id: string;
  name: string;
  treasuries: TreasuryConfig[];
  createdAt: Date;
  updatedAt: Date;
}
