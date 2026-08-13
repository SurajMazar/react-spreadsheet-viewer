import { describe, it, expect } from 'vitest';
import {
  computeAutoFitWidth,
  cellFont,
  AUTO_FIT_MIN_WIDTH,
  AUTO_FIT_MAX_WIDTH,
  AUTO_FIT_PADDING,
  DEFAULT_AUTO_FIT_FONT,
  type MeasureText,
} from '../autoFit';
import type { SheetData } from '../../types';

/**
 * Deterministic stand-in for canvas text measurement: every glyph is 10px wide,
 * doubled for bold, so expected widths can be written out by hand.
 */
const measure: MeasureText = (text, font) => text.length * (font.includes('700') ? 20 : 10);

function sheet(overrides: Partial<SheetData> = {}): SheetData {
  return {
    data: [['ab'], ['abcd'], ['a']],
    rows: 3,
    cols: 1,
    merges: [],
    colWidths: [],
    ...overrides,
  };
}

describe('computeAutoFitWidth', () => {
  it('fits the widest cell in the column, plus padding', () => {
    // "abcd" → 40px of text
    expect(computeAutoFitWidth(0, sheet(), measure)).toBe(40 + AUTO_FIT_PADDING);
  });

  it('measures only the requested column', () => {
    const data = sheet({
      data: [
        ['a', 'aaaaaaaa'],
        ['ab', 'a'],
      ],
      cols: 2,
      rows: 2,
    });
    expect(computeAutoFitWidth(0, data, measure)).toBe(20 + AUTO_FIT_PADDING);
  });

  it('returns null for a column with nothing in it', () => {
    const empty = sheet({ data: [[''], [null], [undefined]] });
    expect(computeAutoFitWidth(0, empty, measure)).toBeNull();
    expect(computeAutoFitWidth(5, sheet(), measure)).toBeNull();
  });

  it('rejects a negative column index', () => {
    expect(computeAutoFitWidth(-1, sheet(), measure)).toBeNull();
  });

  it('accounts for per-cell bold styling', () => {
    const styled = sheet({
      data: [['ab'], ['abcd']],
      rows: 2,
      styles: { '0,0': { bold: true } }, // "ab" bold → 40px, same as "abcd" plain
    });
    expect(computeAutoFitWidth(0, styled, measure)).toBe(40 + AUTO_FIT_PADDING);
  });

  it('uses the longest line of a multi-line cell', () => {
    const multiline = sheet({ data: [['ab\nabcdefgh\nabc']], rows: 1 });
    expect(computeAutoFitWidth(0, multiline, measure)).toBe(80 + AUTO_FIT_PADDING);
  });

  it('clamps to the minimum width', () => {
    const narrow = sheet({ data: [['a']], rows: 1 });
    expect(computeAutoFitWidth(0, narrow, measure)).toBe(AUTO_FIT_MIN_WIDTH);
  });

  it('clamps to the maximum width so one long cell cannot swamp the sheet', () => {
    const wide = sheet({ data: [['x'.repeat(500)]], rows: 1 });
    expect(computeAutoFitWidth(0, wide, measure)).toBe(AUTO_FIT_MAX_WIDTH);
  });

  it('honours custom limits', () => {
    expect(computeAutoFitWidth(0, sheet(), measure, { minWidth: 0, maxWidth: 20 })).toBe(20);
  });

  it('ignores content owned by a merge spanning several columns', () => {
    const merged = sheet({
      data: [['a very long merged title', ''], ['ab', 'cd']],
      rows: 2,
      cols: 2,
      merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }],
    });
    expect(computeAutoFitWidth(0, merged, measure)).toBe(20 + AUTO_FIT_PADDING);
  });

  it('still counts a merge confined to one column', () => {
    const merged = sheet({
      data: [['abcdef'], ['ab']],
      rows: 2,
      merges: [{ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }],
    });
    expect(computeAutoFitWidth(0, merged, measure)).toBe(60 + AUTO_FIT_PADDING);
  });

  it('stops scanning at the row cap', () => {
    const data = Array.from({ length: 50 }, (_, i) => [i === 40 ? 'aaaaaaaaaa' : 'ab']);
    const long = sheet({ data, rows: 50 });
    // Row 40 is past the cap, so the fit comes from the leading rows only.
    expect(computeAutoFitWidth(0, long, measure, { maxScanRows: 10 })).toBe(20 + AUTO_FIT_PADDING);
  });
});

describe('cellFont', () => {
  it('falls back to the base font for unstyled cells', () => {
    expect(cellFont(undefined, DEFAULT_AUTO_FIT_FONT)).toBe(
      `400 13px ${DEFAULT_AUTO_FIT_FONT.family}`
    );
  });

  it('reflects weight and slant', () => {
    expect(cellFont({ bold: true, italic: true }, DEFAULT_AUTO_FIT_FONT)).toBe(
      `italic 700 13px ${DEFAULT_AUTO_FIT_FONT.family}`
    );
  });

  it('converts an explicit point size to pixels', () => {
    // 12pt = 16px
    expect(cellFont({ fontSize: 12 }, DEFAULT_AUTO_FIT_FONT)).toBe(
      `400 16px ${DEFAULT_AUTO_FIT_FONT.family}`
    );
  });
});
