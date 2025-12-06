'use client';

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import {
  TreasuryChartData,
  TreasurySnapshotDataPoint,
  TokenBreakdownData,
  ChainDistributionData,
  DEFAULT_CHART_THEME,
} from './types';

interface TreasuryValueChartProps {
  data: TreasurySnapshotDataPoint[];
  height?: number;
}

export const TreasuryValueChart: React.FC<TreasuryValueChartProps> = ({
  data,
  height = 300,
}) => {
  const formatValue = (value: number): string => {
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatValue(payload[0].value as number)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="treasuryGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={DEFAULT_CHART_THEME.colors.primary}
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor={DEFAULT_CHART_THEME.colors.primary}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            className="text-gray-500 dark:text-gray-400"
          />
          <YAxis
            tickFormatter={formatValue}
            tick={{ fontSize: 12 }}
            className="text-gray-500 dark:text-gray-400"
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="totalValueUsd"
            stroke={DEFAULT_CHART_THEME.colors.primary}
            strokeWidth={2}
            fill="url(#treasuryGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

interface TokenBreakdownChartProps {
  data: TokenBreakdownData[];
  height?: number;
}

export const TokenBreakdownChart: React.FC<TokenBreakdownChartProps> = ({
  data,
  height = 300,
}) => {
  const formatValue = (value: number): string => {
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const CustomTooltip = ({
    active,
    payload,
  }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as TokenBreakdownData;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-white">
            {data.name} ({data.symbol})
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {formatValue(data.valueUsd)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {data.percentage.toFixed(1)}% of treasury
          </p>
        </div>
      );
    }
    return null;
  };

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    symbol,
  }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
    symbol: string;
  }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {symbol}
      </text>
    );
  };

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="valueUsd"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value, entry) => (
              <span className="text-gray-700 dark:text-gray-300">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

interface ChainDistributionChartProps {
  data: ChainDistributionData[];
  height?: number;
}

export const ChainDistributionChart: React.FC<ChainDistributionChartProps> = ({
  data,
  height = 300,
}) => {
  const formatValue = (value: number): string => {
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const CustomTooltip = ({
    active,
    payload,
  }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChainDistributionData;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-white">
            {data.chainName}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {formatValue(data.valueUsd)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {data.percentage.toFixed(1)}% of treasury
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            type="number"
            tickFormatter={formatValue}
            tick={{ fontSize: 12 }}
            className="text-gray-500 dark:text-gray-400"
          />
          <YAxis
            type="category"
            dataKey="chainName"
            tick={{ fontSize: 12 }}
            className="text-gray-500 dark:text-gray-400"
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="valueUsd" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export interface TreasuryDashboardChartsProps {
  chartData: TreasuryChartData;
}

export const TreasuryDashboardCharts: React.FC<TreasuryDashboardChartsProps> = ({
  chartData,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Treasury Value Over Time
        </h3>
        <TreasuryValueChart data={chartData.snapshots} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Token Breakdown
        </h3>
        <TokenBreakdownChart data={chartData.tokenBreakdown} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm lg:col-span-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Chain Distribution
        </h3>
        <ChainDistributionChart data={chartData.chainDistribution} />
      </div>
    </div>
  );
};
