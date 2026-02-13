import { describe, it, expect } from 'vitest';
import {
  colLetterToIndex,
  colIndexToLetter,
  parseRangeExpression,
  isCellInRanges,
  getCellBorderInRanges,
  rangeToString,
} from '../rangeParser';

describe('colLetterToIndex', () => {
  it('converts single letters', () => {
    expect(colLetterToIndex('A')).toBe(0);
    expect(colLetterToIndex('B')).toBe(1);
    expect(colLetterToIndex('Z')).toBe(25);
  });

  it('converts multi-letter columns', () => {
    expect(colLetterToIndex('AA')).toBe(26);
    expect(colLetterToIndex('AB')).toBe(27);
    expect(colLetterToIndex('AZ')).toBe(51);
    expect(colLetterToIndex('BA')).toBe(52);
  });
});

describe('colIndexToLetter', () => {
  it('converts single digit indices', () => {
    expect(colIndexToLetter(0)).toBe('A');
    expect(colIndexToLetter(1)).toBe('B');
    expect(colIndexToLetter(25)).toBe('Z');
  });

  it('converts multi-letter indices', () => {
    expect(colIndexToLetter(26)).toBe('AA');
    expect(colIndexToLetter(27)).toBe('AB');
    expect(colIndexToLetter(51)).toBe('AZ');
    expect(colIndexToLetter(52)).toBe('BA');
  });

  it('round-trips with colLetterToIndex', () => {
    for (let i = 0; i < 100; i++) {
      expect(colLetterToIndex(colIndexToLetter(i))).toBe(i);
    }
  });
});

describe('parseRangeExpression', () => {
  const maxRows = 100;
  const maxCols = 26;

  it('returns empty array for empty input', () => {
    expect(parseRangeExpression('', maxRows, maxCols)).toEqual([]);
    expect(parseRangeExpression('  ', maxRows, maxCols)).toEqual([]);
  });

  it('parses a single cell reference', () => {
    const result = parseRangeExpression('A1', maxRows, maxCols);
    expect(result).toEqual([{ startRow: 0, startCol: 0, endRow: 0, endCol: 0 }]);
  });

  it('parses a cell range', () => {
    const result = parseRangeExpression('B2:D5', maxRows, maxCols);
    expect(result).toEqual([{ startRow: 1, startCol: 1, endRow: 4, endCol: 3 }]);
  });

  it('parses full column range', () => {
    const result = parseRangeExpression('A:C', maxRows, maxCols);
    expect(result).toEqual([{ startRow: 0, startCol: 0, endRow: 99, endCol: 2 }]);
  });

  it('parses full row range', () => {
    const result = parseRangeExpression('1:5', maxRows, maxCols);
    expect(result).toEqual([{ startRow: 0, startCol: 0, endRow: 4, endCol: 25 }]);
  });

  it('parses comma-separated ranges', () => {
    const result = parseRangeExpression('A1, B2:C3', maxRows, maxCols);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
    expect(result[1]).toEqual({ startRow: 1, startCol: 1, endRow: 2, endCol: 2 });
  });

  it('is case-insensitive', () => {
    const result = parseRangeExpression('a1:b2', maxRows, maxCols);
    expect(result).toEqual([{ startRow: 0, startCol: 0, endRow: 1, endCol: 1 }]);
  });
});

describe('isCellInRanges', () => {
  const ranges = [
    { startRow: 1, startCol: 1, endRow: 3, endCol: 3 },
  ];

  it('returns true for cell inside range', () => {
    expect(isCellInRanges(2, 2, ranges)).toBe(true);
  });

  it('returns true for cell on boundary', () => {
    expect(isCellInRanges(1, 1, ranges)).toBe(true);
    expect(isCellInRanges(3, 3, ranges)).toBe(true);
  });

  it('returns false for cell outside range', () => {
    expect(isCellInRanges(0, 0, ranges)).toBe(false);
    expect(isCellInRanges(4, 4, ranges)).toBe(false);
  });

  it('returns false for empty ranges', () => {
    expect(isCellInRanges(0, 0, [])).toBe(false);
  });
});

describe('getCellBorderInRanges', () => {
  const ranges = [
    { startRow: 1, startCol: 1, endRow: 3, endCol: 3 },
  ];

  it('detects top-left corner borders', () => {
    const borders = getCellBorderInRanges(1, 1, ranges);
    expect(borders.top).toBe(true);
    expect(borders.left).toBe(true);
    expect(borders.bottom).toBe(false);
    expect(borders.right).toBe(false);
  });

  it('detects bottom-right corner borders', () => {
    const borders = getCellBorderInRanges(3, 3, ranges);
    expect(borders.bottom).toBe(true);
    expect(borders.right).toBe(true);
    expect(borders.top).toBe(false);
    expect(borders.left).toBe(false);
  });

  it('inner cell has no borders', () => {
    const borders = getCellBorderInRanges(2, 2, ranges);
    expect(borders.top).toBe(false);
    expect(borders.bottom).toBe(false);
    expect(borders.left).toBe(false);
    expect(borders.right).toBe(false);
  });
});

describe('rangeToString', () => {
  it('formats a single cell', () => {
    expect(rangeToString({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 })).toBe('A1');
  });

  it('formats a range', () => {
    expect(rangeToString({ startRow: 1, startCol: 1, endRow: 4, endCol: 3 })).toBe('B2:D5');
  });
});
