import { z } from 'zod';

/**
 * Environment variable validation schema
 * Ensures all required configuration is present at startup
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database configuration
  DATABASE_PATH: z.string().default('./data/treasury-sentinel.db'),

  // Kaiko API configuration
  KAIKO_API_KEY: z.string().min(1, 'KAIKO_API_KEY is required'),
  KAIKO_API_URL: z.string().url().default('https://us.market-api.kaiko.io'),

  // Base USDC settlement configuration
  BASE_RPC_URL: z.string().url().default('https://mainnet.base.org'),
  BASE_USDC_CONTRACT: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .default('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'),
  SETTLEMENT_WALLET_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  SETTLEMENT_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),

  // Multi-chain RPC endpoints
  ETHEREUM_RPC_URL: z.string().url().default('https://eth.llamarpc.com'),
  GNOSIS_RPC_URL: z.string().url().default('https://rpc.gnosischain.com'),
  ARBITRUM_RPC_URL: z.string().url().default('https://arb1.arbitrum.io/rpc'),
  OPTIMISM_RPC_URL: z.string().url().default('https://mainnet.optimism.io'),

  // Budget enforcement
  DEMO_BUDGET_USDC: z.coerce.number().positive().default(10),
  BUDGET_WARNING_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),

  // Scheduler configuration
  AGENT_CRON_EXPRESSION: z.string().default('*/15 * * * *'),
  AGENT_TIMEZONE: z.string().default('UTC'),

  // Dashboard configuration
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  PORT: z.coerce.number().positive().default(3000),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validated environment configuration
 * Throws on startup if required variables are missing
 */
let envConfig: EnvConfig | null = null;

export function loadEnvConfig(): EnvConfig {
  if (envConfig) {
    return envConfig;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Environment validation failed:\n${errors}`);
  }

  envConfig = result.data;
  return envConfig;
}

/**
 * Get environment config (must call loadEnvConfig first)
 */
export function getEnvConfig(): EnvConfig {
  if (!envConfig) {
    throw new Error('Environment not loaded. Call loadEnvConfig() first.');
  }
  return envConfig;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getEnvConfig().NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getEnvConfig().NODE_ENV === 'development';
}

/**
 * Check if running in test environment
 */
export function isTest(): boolean {
  return getEnvConfig().NODE_ENV === 'test';
}

/**
 * Get chain RPC URL by chain ID
 */
export function getChainRpcUrl(chainId: number): string {
  const config = getEnvConfig();

  const chainRpcMap: Record<number, string> = {
    1: config.ETHEREUM_RPC_URL,
    100: config.GNOSIS_RPC_URL,
    42161: config.ARBITRUM_RPC_URL,
    10: config.OPTIMISM_RPC_URL,
    8453: config.BASE_RPC_URL,
  };

  const rpcUrl = chainRpcMap[chainId];
  if (!rpcUrl) {
    throw new Error(`No RPC URL configured for chain ID: ${chainId}`);
  }

  return rpcUrl;
}
