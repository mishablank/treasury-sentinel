'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  PaymentLedgerEntry,
  LedgerSummary,
  LedgerFilter,
  LedgerPagination,
  LedgerTableProps,
  BudgetGaugeProps,
  LedgerExportOptions,
} from './types';

const formatUSDC = (amount: number): string => {
  return `$${amount.toFixed(6)} USDC`;
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
};

const truncateHash = (hash: string): string => {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
};

const StatusBadge: React.FC<{ status: PaymentLedgerEntry['status'] }> = ({ status }) => {
  const styles: Record<PaymentLedgerEntry['status'], string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    confirmed: 'bg-green-100 text-green-800 border-green-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const EscalationBadge: React.FC<{ level: number }> = ({ level }) => {
  const colors = [
    'bg-gray-100 text-gray-700',
    'bg-blue-100 text-blue-700',
    'bg-cyan-100 text-cyan-700',
    'bg-yellow-100 text-yellow-700',
    'bg-orange-100 text-orange-700',
    'bg-red-100 text-red-700',
  ];

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded ${colors[level] || colors[0]}`}>
      L{level}
    </span>
  );
};

export const BudgetGauge: React.FC<BudgetGaugeProps> = ({
  summary,
  showWarning = true,
  warningThreshold = 80,
}) => {
  const utilizationPercent = summary.budgetUtilization * 100;
  const isWarning = utilizationPercent >= warningThreshold;
  const isCritical = utilizationPercent >= 95;

  const progressColor = isCritical
    ? 'bg-red-500'
    : isWarning
    ? 'bg-yellow-500'
    : 'bg-green-500';

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Budget Status</h3>
        {summary.isBlocked && (
          <span className="px-3 py-1 bg-red-600 text-white text-sm font-bold rounded-full animate-pulse">
            BLOCKED
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Spent</span>
            <span className="font-medium">{formatUSDC(summary.totalSpent)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0 USDC</span>
            <span>{summary.budgetLimit} USDC</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <p className="text-sm text-gray-500">Remaining</p>
            <p className="text-xl font-bold text-gray-900">
              {formatUSDC(summary.budgetRemaining)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Utilization</p>
            <p className={`text-xl font-bold ${isCritical ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-green-600'}`}>
              {utilizationPercent.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <p className="text-sm text-gray-500">Transactions</p>
            <p className="text-lg font-semibold">{summary.transactionCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Avg Size</p>
            <p className="text-lg font-semibold">{formatUSDC(summary.avgTransactionSize)}</p>
          </div>
        </div>

        {showWarning && isWarning && !summary.isBlocked && (
          <div className={`p-3 rounded-lg ${isCritical ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <p className={`text-sm ${isCritical ? 'text-red-700' : 'text-yellow-700'}`}>
              {isCritical
                ? '⚠️ Critical: Budget nearly exhausted. System will block soon.'
                : '⚡ Warning: Budget utilization above threshold.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export const LedgerTable: React.FC<LedgerTableProps> = ({
  entries,
  pagination,
  onPageChange,
  onEntryClick,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">Loading transactions...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Endpoint
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Level
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tx Hash
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No transactions found
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr
                  key={entry.id}
                  className={`hover:bg-gray-50 ${onEntryClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onEntryClick?.(entry)}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(entry.timestamp)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">
                    {entry.endpoint}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatUSDC(entry.amountUSDC)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <EscalationBadge level={entry.escalationLevel} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={entry.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-blue-600">
                    {entry.txHash ? (
                      <a
                        href={`https://basescan.org/tx/${entry.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {truncateHash(entry.txHash)}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
          <p className="text-sm text-gray-700">
            Showing page {pagination.page} of {pagination.totalPages}
            <span className="ml-2 text-gray-500">
              ({pagination.totalItems} total)
            </span>
          </p>
          <div className="flex space-x-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1 text-sm border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 text-sm border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const exportLedger = (
  entries: PaymentLedgerEntry[],
  options: LedgerExportOptions
): string => {
  const filteredEntries = entries.filter((entry) => {
    const filter = options.filter;
    if (!filter) return true;

    if (filter.startDate && entry.timestamp < filter.startDate) return false;
    if (filter.endDate && entry.timestamp > filter.endDate) return false;
    if (filter.status && entry.status !== filter.status) return false;
    if (filter.minAmount !== undefined && entry.amountUSDC < filter.minAmount) return false;
    if (filter.maxAmount !== undefined && entry.amountUSDC > filter.maxAmount) return false;
    if (filter.escalationLevel !== undefined && entry.escalationLevel !== filter.escalationLevel) return false;

    return true;
  });

  const dataToExport = filteredEntries.map((entry) => {
    const result: Record<string, unknown> = {};
    for (const field of options.includeFields) {
      result[field] = entry[field];
    }
    return result;
  });

  if (options.format === 'json') {
    return JSON.stringify(dataToExport, null, 2);
  }

  // CSV format
  const headers = options.includeFields.join(',');
  const rows = dataToExport.map((row) =>
    options.includeFields.map((field) => {
      const value = row[field];
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return String(value ?? '');
    }).join(',')
  );

  return [headers, ...rows].join('\n');
};

export interface PaymentLedgerProps {
  entries: PaymentLedgerEntry[];
  summary: LedgerSummary;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const PaymentLedger: React.FC<PaymentLedgerProps> = ({
  entries,
  summary,
  onRefresh,
  isRefreshing = false,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<LedgerFilter>({});
  const pageSize = 10;

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (filter.status && entry.status !== filter.status) return false;
      if (filter.escalationLevel !== undefined && entry.escalationLevel !== filter.escalationLevel) return false;
      return true;
    });
  }, [entries, filter]);

  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, currentPage]);

  const pagination: LedgerPagination = {
    page: currentPage,
    pageSize,
    totalItems: filteredEntries.length,
    totalPages: Math.ceil(filteredEntries.length / pageSize),
  };

  const handleExport = useCallback((format: 'csv' | 'json') => {
    const content = exportLedger(entries, {
      format,
      includeFields: ['id', 'timestamp', 'endpoint', 'amountUSDC', 'status', 'txHash', 'escalationLevel'],
      filter,
    });

    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' : 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-ledger-${new Date().toISOString().split('T')[0]}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries, filter]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Payment Ledger</h2>
        <div className="flex space-x-3">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center"
            >
              {isRefreshing ? (
                <span className="animate-spin mr-2">⟳</span>
              ) : (
                <span className="mr-2">↻</span>
              )}
              Refresh
            </button>
          )}
          <button
            onClick={() => handleExport('csv')}
            className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
          >
            Export JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <BudgetGauge summary={summary} />
        </div>
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <div className="flex space-x-4">
              <select
                value={filter.status || ''}
                onChange={(e) => setFilter({ ...filter, status: e.target.value as PaymentLedgerEntry['status'] || undefined })}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="failed">Failed</option>
              </select>
              <select
                value={filter.escalationLevel ?? ''}
                onChange={(e) => setFilter({ ...filter, escalationLevel: e.target.value ? parseInt(e.target.value) : undefined })}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">All Levels</option>
                {[0, 1, 2, 3, 4, 5].map((level) => (
                  <option key={level} value={level}>L{level}</option>
                ))}
              </select>
            </div>
          </div>
          <LedgerTable
            entries={paginatedEntries}
            pagination={pagination}
            onPageChange={setCurrentPage}
            isLoading={isRefreshing}
          />
        </div>
      </div>
    </div>
  );
};

export default PaymentLedger;
