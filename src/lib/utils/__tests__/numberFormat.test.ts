import { describe, it, expect } from 'vitest';
import { formatCellValue, excelSerialToDate } from '../numberFormat';

describe('formatCellValue', () => {
  it('leaves values alone without a format, with General and with @', () => {
    expect(formatCellValue(1.5, undefined)).toBe('1.5');
    expect(formatCellValue(1.5, 'General')).toBe('1.5');
    expect(formatCellValue('00123', '@')).toBe('00123');
    expect(formatCellValue(12345, '@')).toBe('12345');
  });

  it('renders empty values as empty text', () => {
    expect(formatCellValue(null, '0.00')).toBe('');
    expect(formatCellValue(undefined, '0.00')).toBe('');
  });

  it('applies fixed decimals', () => {
    expect(formatCellValue(3, '0.00')).toBe('3.00');
    expect(formatCellValue(2.345, '0.0')).toBe('2.3');
    expect(formatCellValue(2.6, '0')).toBe('3');
    expect(formatCellValue(-1.5, '0.00')).toBe('-1.50');
  });

  it('does not show negative zero', () => {
    expect(formatCellValue(-0.001, '0.00')).toBe('0.00');
  });

  it('formats numeric strings too', () => {
    expect(formatCellValue('1234.5', '#,##0.00')).toBe('1,234.50');
  });

  it('leaves non-numeric text and booleans unchanged', () => {
    expect(formatCellValue('Revenue', '0.00')).toBe('Revenue');
    expect(formatCellValue(true, '0.00')).toBe('true');
  });

  it('groups thousands', () => {
    expect(formatCellValue(1234567, '#,##0')).toBe('1,234,567');
    expect(formatCellValue(-1234567.891, '#,##0.00')).toBe('-1,234,567.89');
  });

  it('formats percentages', () => {
    expect(formatCellValue(0.256, '0%')).toBe('26%');
    expect(formatCellValue(0.256, '0.00%')).toBe('25.60%');
  });

  it('formats Excel serial dates', () => {
    // 45292 = 2024-01-01
    expect(formatCellValue(45292, 'dd/mm/yyyy')).toBe('01/01/2024');
    expect(formatCellValue(45323, 'mm/dd/yyyy')).toBe('02/01/2024');
    expect(formatCellValue(45292, 'yyyy-mm-dd')).toBe('2024-01-01');
    expect(formatCellValue(45292, 'd-mmm-yy')).toBe('1-Jan-24');
  });

  it('falls back to the plain value for formats it does not handle', () => {
    expect(formatCellValue(1234.5, '$#,##0.00')).toBe('1234.5');
    expect(formatCellValue(0.5, 'hh:mm')).toBe('0.5');
  });
});

describe('excelSerialToDate', () => {
  it('maps serials to UTC dates', () => {
    expect(excelSerialToDate(45292).toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });
});
