'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '../layout/DashboardLayout';
import { TreasuryOverviewChart, LiquidityGaugeChart } from '../charts/TreasuryCharts';
import { PaymentLedger } from '../ledger/PaymentLedger';
import { EscalationFlowVisualization } from '../flow/EscalationFlowVisualization';
import { EscalationLevel } from '../../types/escalation';
import { ChainTreasuryBalance, TreasurySnapshot } from '../../types/treasury';
import { PaymentLedgerEntry } from '../ledger/types';

export interface DashboardState {
  currentLevel: EscalationLevel;
  treasurySnapshots: TreasurySnapshot[];
  paymentHistory: PaymentLedgerEntry[];
  liquidityMetrics: {
    lcr: number;
    exitHalfLife: number;
    volatilityRegime: 'low' | 'medium' | 'high' | 'extreme';
  };
  budgetStatus: {
    remaining: number;
    total: number;
    status: 'active' | 'warning' | 'blocked';
  };
  isLoading: boolean;
  lastUpdated: Date | null;
}

const initialState: DashboardState = {
  currentLevel: EscalationLevel.L0_IDLE,
  treasurySnapshots: [],
  paymentHistory: [],
  liquidityMetrics: {
    lcr: 1.5,
    exitHalfLife: 24,
    volatilityRegime: 'low',
  },
  budgetStatus: {
    remaining: 10,
    total: 10,
    status: 'active',
  },
  isLoading: true,
  lastUpdated: null,
};

export const DashboardPage: React.FC = () => {
  const [state, setState] = useState<DashboardState>(initialState);

  // Simulated data loading - will be replaced with real API calls
  useEffect(() => {
    const loadDashboardData = async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockSnapshots: TreasurySnapshot[] = [
        {
          id: '1',
          timestamp: new Date(Date.now() - 3600000),
          balances: [
            { chainId: 1, chainName: 'Ethereum', tokenAddress: '0x...', tokenSymbol: 'USDC', balance: '5000000', balanceUSD: 5000000 },
            { chainId: 100, chainName: 'Gnosis', tokenAddress: '0x...', tokenSymbol: 'USDC', balance: '2000000', balanceUSD: 2000000 },
          ],
          totalValueUSD: 7000000,
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 7200000),
          balances: [
            { chainId: 1, chainName: 'Ethereum', tokenAddress: '0x...', tokenSymbol: 'USDC', balance: '4800000', balanceUSD: 4800000 },
            { chainId: 100, chainName: 'Gnosis', tokenAddress: '0x...', tokenSymbol: 'USDC', balance: '1900000', balanceUSD: 1900000 },
          ],
          totalValueUSD: 6700000,
        },
      ];

      const mockPayments: PaymentLedgerEntry[] = [
        {
          id: '1',
          timestamp: new Date(Date.now() - 1800000),
          amount: 0.05,
          currency: 'USDC',
          recipient: 'Kaiko API',
          purpose: 'L2 Market Data Request',
          txHash: '0xabc...123',
          status: 'confirmed',
          escalationLevel: EscalationLevel.L2_MARKET_DATA,
        },
      ];

      setState(prev => ({
        ...prev,
        treasurySnapshots: mockSnapshots,
        paymentHistory: mockPayments,
        currentLevel: EscalationLevel.L1_MONITORING,
        isLoading: false,
        lastUpdated: new Date(),
      }));
    };

    loadDashboardData();
  }, []);

  const chartData = useMemo(() => {
    return state.treasurySnapshots.map(snapshot => ({
      timestamp: snapshot.timestamp,
      totalValue: snapshot.totalValueUSD,
      byChain: snapshot.balances.reduce((acc, bal) => {
        acc[bal.chainName] = bal.balanceUSD;
        return acc;
      }, {} as Record<string, number>),
    }));
  }, [state.treasurySnapshots]);

  const handleLevelTransition = (fromLevel: EscalationLevel, toLevel: EscalationLevel) => {
    console.log(`Escalation transition: ${fromLevel} -> ${toLevel}`);
    setState(prev => ({ ...prev, currentLevel: toLevel }));
  };

  if (state.isLoading) {
    return (
      <DashboardLayout
        currentEscalationLevel={0}
        budgetStatus={state.budgetStatus}
      >
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading dashboard data...</p>
          <style jsx>{`
            .loading-state {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 400px;
              color: #9ca3af;
            }
            .loading-spinner {
              width: 48px;
              height: 48px;
              border: 3px solid #374151;
              border-top-color: #3b82f6;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin-bottom: 16px;
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      currentEscalationLevel={state.currentLevel}
      budgetStatus={state.budgetStatus}
    >
      <div className="dashboard-page">
        <style jsx>{`
          .dashboard-page {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }

          .dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .dashboard-title {
            font-size: 24px;
            font-weight: 600;
            color: #f9fafb;
            margin: 0;
          }

          .last-updated {
            font-size: 12px;
            color: #6b7280;
          }

          .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 24px;
          }

          .dashboard-card {
            background: #1f2937;
            border-radius: 12px;
            padding: 20px;
            border: 1px solid #374151;
          }

          .card-title {
            font-size: 16px;
            font-weight: 500;
            color: #f9fafb;
            margin: 0 0 16px 0;
          }

          .full-width {
            grid-column: 1 / -1;
          }

          .metrics-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
          }

          .metric-card {
            background: #111827;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
          }

          .metric-value {
            font-size: 28px;
            font-weight: 700;
            color: #f9fafb;
            margin-bottom: 4px;
          }

          .metric-label {
            font-size: 12px;
            color: #9ca3af;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .metric-value.positive { color: #10b981; }
          .metric-value.warning { color: #f59e0b; }
          .metric-value.negative { color: #ef4444; }

          @media (max-width: 1200px) {
            .metrics-row {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          @media (max-width: 600px) {
            .metrics-row {
              grid-template-columns: 1fr;
            }
            .dashboard-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>

        <div className="dashboard-header">
          <h1 className="dashboard-title">Treasury Sentinel</h1>
          {state.lastUpdated && (
            <span className="last-updated">
              Last updated: {state.lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="metrics-row">
          <div className="metric-card">
            <div className="metric-value positive">
              ${(state.treasurySnapshots[0]?.totalValueUSD / 1000000).toFixed(2)}M
            </div>
            <div className="metric-label">Total Treasury</div>
          </div>
          <div className="metric-card">
            <div className={`metric-value ${state.liquidityMetrics.lcr >= 1.5 ? 'positive' : 'warning'}`}>
              {state.liquidityMetrics.lcr.toFixed(2)}
            </div>
            <div className="metric-label">Liquidity Coverage</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">
              {state.liquidityMetrics.exitHalfLife}h
            </div>
            <div className="metric-label">Exit Half-Life</div>
          </div>
          <div className="metric-card">
            <div className={`metric-value ${state.budgetStatus.status === 'active' ? 'positive' : 'warning'}`}>
              ${state.budgetStatus.remaining.toFixed(2)}
            </div>
            <div className="metric-label">Budget Remaining</div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <h3 className="card-title">Treasury Overview</h3>
            <TreasuryOverviewChart
              data={chartData}
              height={300}
            />
          </div>

          <div className="dashboard-card">
            <h3 className="card-title">Liquidity Health</h3>
            <LiquidityGaugeChart
              lcr={state.liquidityMetrics.lcr}
              exitHalfLife={state.liquidityMetrics.exitHalfLife}
              volatilityRegime={state.liquidityMetrics.volatilityRegime}
              height={300}
            />
          </div>

          <div className="dashboard-card full-width">
            <h3 className="card-title">Escalation State Machine</h3>
            <EscalationFlowVisualization
              currentLevel={state.currentLevel}
              onLevelClick={handleLevelTransition}
              height={400}
            />
          </div>

          <div className="dashboard-card full-width">
            <h3 className="card-title">Payment Ledger</h3>
            <PaymentLedger
              entries={state.paymentHistory}
              budgetTotal={state.budgetStatus.total}
              budgetRemaining={state.budgetStatus.remaining}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
