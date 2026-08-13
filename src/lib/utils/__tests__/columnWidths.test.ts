import { describe, it, expect } from 'vitest';
import {
  colInfoToPx,
  buildColWidths,
  DEFAULT_MDW,
  MIN_PARSED_COL_WIDTH,
  MAX_PARSED_COL_WIDTH,
} from '../columnWidths';

describe('colInfoToPx', () => {
  it('returns undefined for a column with no width information', () => {
    expect(colInfoToPx(undefined)).toBeUndefined();
    expect(colInfoToPx(null)).toBeUndefined();
    expect(colInfoToPx({})).toBeUndefined();
  });

  it('prefers wpx, which SheetJS has already resolved to pixels', () => {
    expect(colInfoToPx({ wpx: 200, wch: 8.43, width: 9.14 })).toBe(200);
  });

  it('rounds fractional pixel widths', () => {
    expect(colInfoToPx({ wpx: 120.4 })).toBe(120);
    expect(colInfoToPx({ wpx: 120.6 })).toBe(121);
  });

  it('converts character widths using the max-digit width plus padding', () => {
    // Excel's default column: 8.43 characters renders as 64px at MDW 7.
    expect(colInfoToPx({ wch: 8.43 })).toBe(64);
  });

  it('honours a workbook-specific MDW over the default', () => {
    expect(colInfoToPx({ wch: 10, MDW: 6 })).toBe(65);
    expect(colInfoToPx({ wch: 10 })).toBe(10 * DEFAULT_MDW + 5);
  });

  it('falls back to the raw width attribute, which already includes padding', () => {
    expect(colInfoToPx({ width: 9.140625 })).toBe(Math.round(9.140625 * DEFAULT_MDW));
  });

  it('ignores non-positive widths', () => {
    expect(colInfoToPx({ wpx: 0, wch: 0, width: 0 })).toBeUndefined();
    expect(colInfoToPx({ wpx: -10 })).toBeUndefined();
  });

  it('clamps to the parsed width limits', () => {
    expect(colInfoToPx({ wpx: 1 })).toBe(MIN_PARSED_COL_WIDTH);
    expect(colInfoToPx({ wpx: 99999 })).toBe(MAX_PARSED_COL_WIDTH);
  });
});

describe('buildColWidths', () => {
  it('returns an empty array when the sheet declares no columns', () => {
    expect(buildColWidths(undefined)).toEqual([]);
    expect(buildColWidths([])).toEqual([]);
  });

  it('maps each entry to pixels by index', () => {
    const widths = buildColWidths([{ wpx: 150 }, { wpx: 80 }]);
    expect(widths[0]).toBe(150);
    expect(widths[1]).toBe(80);
  });

  it('leaves unsized columns as holes so they keep the viewer default', () => {
    const widths = buildColWidths([{ wpx: 150 }, undefined, {}, { wpx: 80 }]);
    expect(widths[0]).toBe(150);
    expect(widths[1]).toBeUndefined();
    expect(widths[2]).toBeUndefined();
    expect(widths[3]).toBe(80);
    expect(widths).toHaveLength(4);
  });
});
