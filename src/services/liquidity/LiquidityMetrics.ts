/**
 * Liquidity risk metrics calculation service
 */

import {
  LiquidityRiskAssessment,
  LCRResult,
  ExitHalfLife,
  VolatilityRegime,
  DepthBand,
  ImpactCurve,
  ImpactPoint,
  VolatilityThresholds,
  LiquidityMetricsConfig,
  DEFAULT_VOLATILITY_THRESHOLDS,
  DEFAULT_LIQUIDITY_CONFIG,
} from '../../types/liquidity';
import { TreasurySnapshot, TokenBalance } from '../../types/treasury';

export class LiquidityMetrics {
  private config: LiquidityMetricsConfig;
  private volatilityThresholds: VolatilityThresholds;

  constructor(
    config: Partial<LiquidityMetricsConfig> = {},
    thresholds: Partial<VolatilityThresholds> = {}
  ) {
    this.config = { ...DEFAULT_LIQUIDITY_CONFIG, ...config };
    this.volatilityThresholds = { ...DEFAULT_VOLATILITY_THRESHOLDS, ...thresholds };
  }

  /**
   * Calculate Liquidity Coverage Ratio
   * LCR = High Quality Liquid Assets / Net Cash Outflows (30-day)
   */
  calculateLCR(
    liquidAssets: number,
    projectedOutflows: number,
    projectedInflows: number = 0
  ): LCRResult {
    const netOutflows = Math.max(projectedOutflows - Math.min(projectedInflows, projectedOutflows * 0.75), 0);
    const ratio = netOutflows > 0 ? liquidAssets / netOutflows : Infinity;

    return {
      ratio,
      highQualityLiquidAssets: liquidAssets,
      netCashOutflows30Day: netOutflows,
      isCompliant: ratio >= this.config.lcrComplianceThreshold,
      complianceThreshold: this.config.lcrComplianceThreshold,
    };
  }

  /**
   * Calculate exit half-life for a position
   * Time required to liquidate 50% of position without excessive market impact
   */
  calculateExitHalfLife(
    tokenAddress: string,
    tokenSymbol: string,
    positionSize: number,
    averageDailyVolume: number
  ): ExitHalfLife {
    const maxDailyExecution = averageDailyVolume * this.config.maxParticipationRate;
    const halfPosition = positionSize / 2;
    const halfLifeHours = maxDailyExecution > 0 ? (halfPosition / maxDailyExecution) * 24 : Infinity;
    const fullExitHours = maxDailyExecution > 0 ? (positionSize / maxDailyExecution) * 24 : Infinity;

    return {
      tokenAddress,
      tokenSymbol,
      positionSize,
      halfLifeHours,
      fullExitHours,
      averageDailyVolume,
      participationRate: this.config.maxParticipationRate,
    };
  }

  /**
   * Detect volatility regime from historical returns
   */
  detectVolatilityRegime(returns: number[]): VolatilityRegime {
    if (returns.length < 2) {
      return 'normal';
    }

    const annualizedVol = this.calculateAnnualizedVolatility(returns);

    if (annualizedVol <= this.volatilityThresholds.low) {
      return 'low';
    } else if (annualizedVol <= this.volatilityThresholds.normal) {
      return 'normal';
    } else if (annualizedVol <= this.volatilityThresholds.elevated) {
      return 'elevated';
    } else if (annualizedVol <= this.volatilityThresholds.high) {
      return 'high';
    } else {
      return 'extreme';
    }
  }

  /**
   * Calculate annualized volatility from daily returns
   */
  calculateAnnualizedVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const squaredDiffs = returns.map((r) => Math.pow(r - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (returns.length - 1);
    const dailyVol = Math.sqrt(variance);

    // Annualize assuming 365 trading days for crypto
    return dailyVol * Math.sqrt(365);
  }

  /**
   * Generate depth bands from order book data
   */
  generateDepthBands(
    midPrice: number,
    bids: Array<{ price: number; quantity: number }>,
    asks: Array<{ price: number; quantity: number }>
  ): DepthBand[] {
    const bands: DepthBand[] = [];

    for (const percentage of this.config.depthBandPercentages) {
      const lowerBound = midPrice * (1 - percentage / 100);
      const upperBound = midPrice * (1 + percentage / 100);

      const bidLiquidity = bids
        .filter((b) => b.price >= lowerBound)
        .reduce((sum, b) => sum + b.quantity * b.price, 0);

      const askLiquidity = asks
        .filter((a) => a.price <= upperBound)
        .reduce((sum, a) => sum + a.quantity * a.price, 0);

      const cumulativeBid = bids
        .filter((b) => b.price >= lowerBound)
        .reduce((sum, b) => sum + b.quantity * b.price, 0);

      const cumulativeAsk = asks
        .filter((a) => a.price <= upperBound)
        .reduce((sum, a) => sum + a.quantity * a.price, 0);

      bands.push({
        priceLevel: midPrice,
        percentFromMid: percentage,
        bidLiquidity,
        askLiquidity,
        cumulativeBidLiquidity: cumulativeBid,
        cumulativeAskLiquidity: cumulativeAsk,
      });
    }

    return bands;
  }

  /**
   * Calculate market impact curve for a token
   */
  calculateImpactCurve(
    tokenAddress: string,
    tokenSymbol: string,
    basePrice: number,
    asks: Array<{ price: number; quantity: number }>
  ): ImpactCurve {
    const sortedAsks = [...asks].sort((a, b) => a.price - b.price);
    const points: ImpactPoint[] = [];
    let maxTradeableSize = 0;

    for (const targetSize of this.config.impactCurveSizes) {
      let remainingSize = targetSize;
      let totalCost = 0;
      let totalQuantity = 0;

      for (const ask of sortedAsks) {
        if (remainingSize <= 0) break;

        const fillQuantity = Math.min(remainingSize / ask.price, ask.quantity);
        const fillValue = fillQuantity * ask.price;

        totalCost += fillValue;
        totalQuantity += fillQuantity;
        remainingSize -= fillValue;
      }

      if (totalQuantity > 0) {
        const executionPrice = totalCost / totalQuantity;
        const slippage = (executionPrice - basePrice) / basePrice;
        const priceImpact = slippage * 100;

        points.push({
          tradeSize: targetSize,
          expectedSlippage: slippage,
          priceImpact,
          executionPrice,
        });

        if (remainingSize <= 0) {
          maxTradeableSize = Math.max(maxTradeableSize, targetSize);
        }
      }
    }

    return {
      tokenAddress,
      tokenSymbol,
      basePrice,
      points,
      maxTradeableSize,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate overall risk score from metrics (0-100)
   */
  calculateOverallRiskScore(
    lcr: LCRResult,
    exitHalfLives: ExitHalfLife[],
    volatilityRegime: VolatilityRegime
  ): number {
    // LCR component (0-40 points)
    let lcrScore = 0;
    if (lcr.ratio >= 2) lcrScore = 0;
    else if (lcr.ratio >= 1.5) lcrScore = 10;
    else if (lcr.ratio >= 1) lcrScore = 20;
    else if (lcr.ratio >= 0.5) lcrScore = 30;
    else lcrScore = 40;

    // Exit half-life component (0-30 points)
    const avgHalfLife =
      exitHalfLives.length > 0
        ? exitHalfLives.reduce((sum, e) => sum + e.halfLifeHours, 0) / exitHalfLives.length
        : 0;
    let halfLifeScore = 0;
    if (avgHalfLife <= 24) halfLifeScore = 0;
    else if (avgHalfLife <= 72) halfLifeScore = 10;
    else if (avgHalfLife <= 168) halfLifeScore = 20;
    else halfLifeScore = 30;

    // Volatility component (0-30 points)
    const volScores: Record<VolatilityRegime, number> = {
      low: 0,
      normal: 5,
      elevated: 15,
      high: 25,
      extreme: 30,
    };
    const volScore = volScores[volatilityRegime];

    return lcrScore + halfLifeScore + volScore;
  }

  /**
   * Get risk level from overall score
   */
  getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score <= 25) return 'low';
    if (score <= 50) return 'medium';
    if (score <= 75) return 'high';
    return 'critical';
  }

  /**
   * Build complete liquidity risk assessment
   */
  buildAssessment(
    treasuryAddress: string,
    chainId: number,
    lcr: LCRResult,
    exitHalfLives: ExitHalfLife[],
    volatilityRegime: VolatilityRegime,
    depthBands: Map<string, DepthBand[]>,
    impactCurves: Map<string, ImpactCurve>
  ): LiquidityRiskAssessment {
    const overallRiskScore = this.calculateOverallRiskScore(lcr, exitHalfLives, volatilityRegime);

    return {
      treasuryAddress,
      chainId,
      assessmentTimestamp: new Date(),
      lcr,
      exitHalfLives,
      volatilityRegime,
      depthBands,
      impactCurves,
      overallRiskScore,
      riskLevel: this.getRiskLevel(overallRiskScore),
    };
  }
}
