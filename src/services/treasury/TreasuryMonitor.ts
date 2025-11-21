import {
  Chain,
  TreasurySnapshot,
  TokenBalance,
  TreasuryConfig,
  ChainConfig,
} from '../../types/treasury';

export const DEFAULT_CHAIN_CONFIGS: Record<Chain, ChainConfig> = {
  ethereum: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
  },
  gnosis: {
    chainId: 100,
    name: 'Gnosis Chain',
    rpcUrl: process.env.GNOSIS_RPC_URL || 'https://rpc.gnosischain.com',
    blockExplorer: 'https://gnosisscan.io',
    nativeCurrency: { symbol: 'xDAI', decimals: 18 },
  },
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
  },
  optimism: {
    chainId: 10,
    name: 'Optimism',
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
  },
  base: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
  },
};

// Standard ERC-20 ABI for balanceOf and decimals
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const;

export class TreasuryMonitor {
  private config: TreasuryConfig;
  private chainConfigs: Record<Chain, ChainConfig>;

  constructor(
    config: TreasuryConfig,
    chainConfigs: Record<Chain, ChainConfig> = DEFAULT_CHAIN_CONFIGS
  ) {
    this.config = config;
    this.chainConfigs = chainConfigs;
  }

  async fetchNativeBalance(chain: Chain, address: string): Promise<bigint> {
    const chainConfig = this.chainConfigs[chain];
    
    const response = await fetch(chainConfig.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1,
      }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }

    return BigInt(data.result);
  }

  async fetchERC20Balance(
    chain: Chain,
    tokenAddress: string,
    walletAddress: string
  ): Promise<{ balance: bigint; decimals: number; symbol: string }> {
    const chainConfig = this.chainConfigs[chain];

    // Encode balanceOf call
    const balanceOfSelector = '0x70a08231';
    const paddedAddress = walletAddress.slice(2).padStart(64, '0');
    const balanceOfData = balanceOfSelector + paddedAddress;

    // Fetch balance
    const balanceResponse = await fetch(chainConfig.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: tokenAddress, data: balanceOfData }, 'latest'],
        id: 1,
      }),
    });

    const balanceData = await balanceResponse.json();
    if (balanceData.error) {
      throw new Error(`Balance fetch error: ${balanceData.error.message}`);
    }

    // Fetch decimals
    const decimalsSelector = '0x313ce567';
    const decimalsResponse = await fetch(chainConfig.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: tokenAddress, data: decimalsSelector }, 'latest'],
        id: 2,
      }),
    });

    const decimalsData = await decimalsResponse.json();
    const decimals = decimalsData.error ? 18 : parseInt(decimalsData.result, 16);

    // Fetch symbol
    const symbolSelector = '0x95d89b41';
    const symbolResponse = await fetch(chainConfig.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: tokenAddress, data: symbolSelector }, 'latest'],
        id: 3,
      }),
    });

    const symbolData = await symbolResponse.json();
    let symbol = 'UNKNOWN';
    if (!symbolData.error && symbolData.result !== '0x') {
      try {
        // Decode string from ABI-encoded response
        const hex = symbolData.result.slice(2);
        const offset = parseInt(hex.slice(0, 64), 16) * 2;
        const length = parseInt(hex.slice(64, 128), 16);
        const symbolHex = hex.slice(128, 128 + length * 2);
        symbol = Buffer.from(symbolHex, 'hex').toString('utf8');
      } catch {
        symbol = 'UNKNOWN';
      }
    }

    return {
      balance: BigInt(balanceData.result),
      decimals,
      symbol,
    };
  }

  async fetchBlockNumber(chain: Chain): Promise<number> {
    const chainConfig = this.chainConfigs[chain];

    const response = await fetch(chainConfig.rpcUrl, {
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
    if (data.error) {
      throw new Error(`Block number fetch error: ${data.error.message}`);
    }

    return parseInt(data.result, 16);
  }

  async takeSnapshot(chain: Chain): Promise<TreasurySnapshot> {
    const walletAddress = this.config.walletAddresses[chain];
    if (!walletAddress) {
      throw new Error(`No wallet address configured for chain: ${chain}`);
    }

    const chainConfig = this.chainConfigs[chain];
    const blockNumber = await this.fetchBlockNumber(chain);
    const timestamp = Date.now();

    const balances: TokenBalance[] = [];

    // Fetch native balance
    const nativeBalance = await this.fetchNativeBalance(chain, walletAddress);
    balances.push({
      tokenAddress: '0x0000000000000000000000000000000000000000',
      symbol: chainConfig.nativeCurrency.symbol,
      decimals: chainConfig.nativeCurrency.decimals,
      rawBalance: nativeBalance.toString(),
      formattedBalance: this.formatBalance(
        nativeBalance,
        chainConfig.nativeCurrency.decimals
      ),
    });

    // Fetch ERC-20 balances for tracked tokens
    const trackedTokens = this.config.trackedTokens[chain] || [];
    for (const tokenAddress of trackedTokens) {
      try {
        const { balance, decimals, symbol } = await this.fetchERC20Balance(
          chain,
          tokenAddress,
          walletAddress
        );

        balances.push({
          tokenAddress,
          symbol,
          decimals,
          rawBalance: balance.toString(),
          formattedBalance: this.formatBalance(balance, decimals),
        });
      } catch (error) {
        console.error(
          `Failed to fetch balance for token ${tokenAddress} on ${chain}:`,
          error
        );
      }
    }

    return {
      id: `${chain}-${blockNumber}-${timestamp}`,
      chain,
      walletAddress,
      blockNumber,
      timestamp,
      balances,
    };
  }

  async takeMultiChainSnapshot(): Promise<TreasurySnapshot[]> {
    const chains = Object.keys(this.config.walletAddresses) as Chain[];
    const snapshots: TreasurySnapshot[] = [];

    for (const chain of chains) {
      try {
        const snapshot = await this.takeSnapshot(chain);
        snapshots.push(snapshot);
      } catch (error) {
        console.error(`Failed to take snapshot for chain ${chain}:`, error);
      }
    }

    return snapshots;
  }

  private formatBalance(balance: bigint, decimals: number): string {
    const divisor = BigInt(10 ** decimals);
    const integerPart = balance / divisor;
    const fractionalPart = balance % divisor;

    const fractionalStr = fractionalPart
      .toString()
      .padStart(decimals, '0')
      .slice(0, 6);

    return `${integerPart}.${fractionalStr}`;
  }

  getChainConfig(chain: Chain): ChainConfig {
    return this.chainConfigs[chain];
  }

  updateConfig(config: Partial<TreasuryConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
