/**
 * @module utils/formatting
 * @description Utility functions for formatting values in the dashboard
 */

/**
 * Format a number as USD currency
 * @param value - Numeric value to format
 * @param options - Formatting options
 * @returns Formatted currency string
 * @example
 * ```typescript
 * formatUSD(1234567.89) // '$1,234,567.89'
 * formatUSD(1234567.89, { compact: true }) // '$1.23M'
 * ```
 */
export function formatUSD(
  value: number,
  options: { compact?: boolean; decimals?: number } = {}
): string {
  const { compact = false, decimals = 2 } = options;

  if (compact) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: decimals,
    }).format(value);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a percentage value
 * @param value - Decimal value (0.15 = 15%)
 * @param options - Formatting options
 * @returns Formatted percentage string
 * @example
 * ```typescript
 * formatPercent(0.1567) // '15.67%'
 * formatPercent(0.1567, { decimals: 0 }) // '16%'
 * formatPercent(-0.05, { showSign: true }) // '-5.00%'
 * ```
 */
export function formatPercent(
  value: number,
  options: { decimals?: number; showSign?: boolean } = {}
): string {
  const { decimals = 2, showSign = false } = options;
  const percentage = value * 100;
  const sign = showSign && percentage > 0 ? '+' : '';
  return `${sign}${percentage.toFixed(decimals)}%`;
}

/**
 * Format a token balance with appropriate decimals
 * @param balance - Raw balance as bigint
 * @param decimals - Token decimals
 * @param displayDecimals - Number of decimals to display
 * @returns Formatted balance string
 * @example
 * ```typescript
 * formatTokenBalance(BigInt('1000000000000000000'), 18) // '1.0000'
 * formatTokenBalance(BigInt('1500000'), 6, 2) // '1.50'
 * ```
 */
export function formatTokenBalance(
  balance: bigint,
  decimals: number,
  displayDecimals: number = 4
): string {
  const divisor = BigInt(10 ** decimals);
  const integerPart = balance / divisor;
  const fractionalPart = balance % divisor;
  
  const fractionalStr = fractionalPart
    .toString()
    .padStart(decimals, '0')
    .slice(0, displayDecimals);
  
  return `${integerPart.toLocaleString()}.${fractionalStr}`;
}

/**
 * Format a duration in milliseconds to human-readable string
 * @param ms - Duration in milliseconds
 * @returns Human-readable duration
 * @example
 * ```typescript
 * formatDuration(3661000) // '1h 1m 1s'
 * formatDuration(45000) // '45s'
 * formatDuration(90061000) // '1d 1h 1m'
 * ```
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  if (seconds % 60 > 0 && days === 0) parts.push(`${seconds % 60}s`);

  return parts.length > 0 ? parts.join(' ') : '0s';
}

/**
 * Format an Ethereum address with ellipsis
 * @param address - Full Ethereum address
 * @param startChars - Characters to show at start
 * @param endChars - Characters to show at end
 * @returns Truncated address
 * @example
 * ```typescript
 * formatAddress('0x1234567890abcdef1234567890abcdef12345678')
 * // '0x1234...5678'
 * ```
 */
export function formatAddress(
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (address.length <= startChars + endChars) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Format a timestamp to locale string
 * @param timestamp - Unix timestamp (milliseconds)
 * @param options - Date formatting options
 * @returns Formatted date string
 */
export function formatTimestamp(
  timestamp: number,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
  }
): string {
  return new Date(timestamp).toLocaleString('en-US', options);
}

/**
 * Format a relative time (e.g., "2 hours ago")
 * @param timestamp - Unix timestamp (milliseconds)
 * @returns Relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diff = timestamp - Date.now();
  const absDiff = Math.abs(diff);

  if (absDiff < 60000) {
    return rtf.format(Math.round(diff / 1000), 'second');
  } else if (absDiff < 3600000) {
    return rtf.format(Math.round(diff / 60000), 'minute');
  } else if (absDiff < 86400000) {
    return rtf.format(Math.round(diff / 3600000), 'hour');
  } else {
    return rtf.format(Math.round(diff / 86400000), 'day');
  }
}
