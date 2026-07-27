/**
 * Formatting utilities for consistent display across the platform
 */

export const UNIT_LABEL: Record<string, string> = {
  barrel: 'bbl',
  bbl: 'bbl',
  metric_ton: 'MT',
  MT: 'MT',
  kg: 'kg',
  gram: 'gram',
  troy_ounce: 'troy oz',
  'troy oz': 'troy oz'
};

export const fmtQty = (x: number): string =>
  new Intl.NumberFormat('en-US').format(x);

export const fmtPrice = (x: number, currency = 'USD'): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(x);

export const fmtTotalCompact = (x: number, currency = 'USD'): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(x);

export const fmtFullTotal = (x: number, currency = 'USD'): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(x);