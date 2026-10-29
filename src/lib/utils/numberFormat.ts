/**
 * Display formatting for the number formats Docsumo's spreadsheet data uses:
 * fixed decimals (`0`, `0.00`), thousands separators (`#,##0.00`),
 * percentages (`0%`), text (`@`) and dates from Excel serial numbers
 * (`dd/mm/yyyy`, `mm/dd/yyyy`, `yyyy-mm-dd`, `d-mmm-yy`). Any other format
 * falls back to the plain value, so an unexpected format never hides data.
 */
import type { CellValue } from '../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Excel's day 0 (with the 1900 leap-year bug folded in for serials ≥ 61). */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86400000;

const NUMBER_FORMAT = /^(#,##)?0(\.0+)?(%)?$/;
const DATE_FORMAT = /^(?:d{1,2}|m{1,3}|y{2}|y{4}|[\s/.\-,])+$/i;

function toNumber(value: CellValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function excelSerialToDate(serial: number): Date {
  return new Date(EXCEL_EPOCH_MS + Math.round(serial * MS_PER_DAY));
}

function formatDate(serial: number, format: string): string {
  const d = excelSerialToDate(serial);
  return format.replace(/yyyy|yy|mmm|mm|m|dd|d/gi, (token) => {
    switch (token.toLowerCase()) {
      case 'yyyy': return String(d.getUTCFullYear());
      case 'yy': return pad2(d.getUTCFullYear() % 100);
      case 'mmm': return MONTHS[d.getUTCMonth()];
      case 'mm': return pad2(d.getUTCMonth() + 1);
      case 'm': return String(d.getUTCMonth() + 1);
      case 'dd': return pad2(d.getUTCDate());
      default: return String(d.getUTCDate());
    }
  });
}

function formatNumber(n: number, format: string): string | null {
  const m = format.match(NUMBER_FORMAT);
  if (!m) return null;
  const [, grouping, decimals, percent] = m;
  const value = percent ? n * 100 : n;
  let text = Math.abs(value).toFixed(decimals ? decimals.length - 1 : 0);
  if (grouping) {
    const [int, frac] = text.split('.');
    text = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac !== undefined ? `.${frac}` : '');
  }
  // No "-0.00" for values that round to zero.
  const negative = value < 0 && Number(text.replace(/,/g, '')) !== 0;
  return `${negative ? '-' : ''}${text}${percent ? '%' : ''}`;
}

/**
 * Format a value for display through an Excel number format. Non-numeric
 * values, an empty or `General` format, `@` and unsupported formats return
 * the value as text unchanged.
 */
export function formatCellValue(value: CellValue, format: string | undefined | null): string {
  if (value === null || value === undefined) return '';
  const plain = String(value);
  if (!format || format === '@' || /^general$/i.test(format) || typeof value === 'boolean') return plain;

  const n = toNumber(value);
  if (n === null) return plain;

  if (DATE_FORMAT.test(format) && /[dmy]/i.test(format)) return formatDate(n, format);
  return formatNumber(n, format) ?? plain;
}
