import { ChainId } from '../types/treasury';

/**
 * Chain configuration for multi-chain treasury monitoring
 */
export interface ChainConfig {
  chainId: ChainId;
  name: string;
  shortName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorer: string;
  avgBlockTime: number; // in seconds
  isL2: boolean;
}

/**
 * Supported chain configurations
 */
export const CHAIN_CONFIGS: Record<ChainId, ChainConfig> = {
  [ChainId.ETHEREUM]: {
    chainId: ChainId.ETHEREUM,
    name: 'Ethereum Mainnet',
    shortName: 'ETH',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    blockExplorer: 'https://etherscan.io',
    avgBlockTime: 12,
    isL2: false,
  },
  [ChainId.GNOSIS]: {
    chainId: ChainId.GNOSIS,
    name: 'Gnosis Chain',
    shortName: 'GNO',
    nativeCurrency: {
      name: 'xDAI',
      symbol: 'xDAI',
      decimals: 18,
    },
    blockExplorer: 'https://gnosisscan.io',
    avgBlockTime: 5,
    isL2: false,
  },
  [ChainId.ARBITRUM]: {
    chainId: ChainId.ARBITRUM,
    name: 'Arbitrum One',
    shortName: 'ARB',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    blockExplorer: 'https://arbiscan.io',
    avgBlockTime: 0.25,
    isL2: true,
  },
  [ChainId.OPTIMISM]: {
    chainId: ChainId.OPTIMISM,
    name: 'Optimism',
    shortName: 'OP',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    blockExplorer: 'https://optimistic.etherscan.io',
    avgBlockTime: 2,
    isL2: true,
  },
  [ChainId.BASE]: {
    chainId: ChainId.BASE,
    name: 'Base',
    shortName: 'BASE',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    blockExplorer: 'https://basescan.org',
    avgBlockTime: 2,
    isL2: true,
  },
};

/**
 * Common stablecoin addresses across chains
 */
export const STABLECOIN_ADDRESSES: Record<ChainId, Record<string, string>> = {
  [ChainId.ETHEREUM]: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EescdeCB5BE16a9',
  },
  [ChainId.GNOSIS]: {
    USDC: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
    USDT: '0x4ECaBa5870353805a9F068101A40E0f32ed605C6',
    WXDAI: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
  },
  [ChainId.ARBITRUM]: {
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    'USDC.e': '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  },
  [ChainId.OPTIMISM]: {
    USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    'USDC.e': '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  },
  [ChainId.BASE]: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    USDbC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  },
};

/**
 * Get chain config by ID
 */
export function getChainConfig(chainId: ChainId): ChainConfig {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) {
    throw new Error(`Unknown chain ID: ${chainId}`);
  }
  return config;
}

/**
 * Get all supported chain IDs
 */
export function getSupportedChainIds(): ChainId[] {
  return Object.values(ChainId).filter(
    (value): value is ChainId => typeof value === 'number'
  );
}

/**
 * Check if a chain ID is supported
 */
export function isChainSupported(chainId: number): chainId is ChainId {
  return chainId in CHAIN_CONFIGS;
}
