/**
 * Liquidity risk metrics types for treasury risk assessment
 */

/**
 * Volatility regime classifications
 */
export type VolatilityRegime = 'low' | 'normal' | 'elevated' | 'high' | 'extreme';

/**
 * Depth band representing liquidity at a price level
 */
export interface DepthBand {
  priceLevel: number;
  percentFromMid: number;
  bidLiquidity: number;
  askLiquidity: number;
  cumulativeBidLiquidity: number;
  cumulativeAskLiquidity: number;
}

/**
 * Market impact curve point
 */
export interface ImpactPoint {
  tradeSize: number;
  expectedSlippage: number;
  priceImpact: number;
  executionPrice: number;
}

/**
 * Complete impact curve for a token
 */
export interface ImpactCurve {
  tokenAddress: string;
  tokenSymbol: string;
  basePrice: number;
  points: ImpactPoint[];
  maxTradeableSize: number;
  timestamp: Date;
}

/**
 * Liquidity Coverage Ratio calculation
 */
export interface LCRResult {
  ratio: number;
  highQualityLiquidAssets: number;
  netCashOutflows30Day: number;
  isCompliant: boolean;
  complianceThreshold: number;
}

/**
 * Exit half-life metrics - time to liquidate 50% of position
 */
export interface ExitHalfLife {
  tokenAddress: string;
  tokenSymbol: string;
  positionSize: number;
  halfLifeHours: number;
  fullExitHours: number;
  averageDailyVolume: number;
  participationRate: number;
}

/**
 * Complete liquidity risk assessment for a treasury position
 */
export interface LiquidityRiskAssessment {
  treasuryAddress: string;
  chainId: number;
  assessmentTimestamp: Date;
  lcr: LCRResult;
  exitHalfLives: ExitHalfLife[];
  volatilityRegime: VolatilityRegime;
  depthBands: Map<string, DepthBand[]>;
  impactCurves: Map<string, ImpactCurve>;
  overallRiskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Volatility calculation input
 */
export interface VolatilityInput {
  returns: number[];
  windowSize: number;
  annualizationFactor: number;
}

/**
 * Volatility regime thresholds
 */
export interface VolatilityThresholds {
  low: number;
  normal: number;
  elevated: number;
  high: number;
}

export const DEFAULT_VOLATILITY_THRESHOLDS: VolatilityThresholds = {
  low: 0.15,
  normal: 0.30,
  elevated: 0.50,
  high: 0.80,
};

/**
 * Liquidity metrics configuration
 */
export interface LiquidityMetricsConfig {
  lcrComplianceThreshold: number;
  maxParticipationRate: number;
  depthBandPercentages: number[];
  impactCurveSizes: number[];
  volatilityWindow: number;
}

export const DEFAULT_LIQUIDITY_CONFIG: LiquidityMetricsConfig = {
  lcrComplianceThreshold: 1.0, // 100% minimum
  maxParticipationRate: 0.1, // 10% of daily volume
  depthBandPercentages: [0.1, 0.25, 0.5, 1.0, 2.0, 5.0],
  impactCurveSizes: [1000, 5000, 10000, 50000, 100000, 500000],
  volatilityWindow: 30, // days
};
