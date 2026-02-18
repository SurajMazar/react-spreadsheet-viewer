import { describe, it, expect } from 'vitest';
import { evaluateConditionalFormats, interpolateColor } from '../evaluator';
import type { CellRange, CellStyle, CellValue, ConditionalFormatRule, SheetData } from '../../types';

function makeSheetData(data: CellValue[][]): SheetData {
  return {
    data,
    rows: data.length,
    cols: data[0]?.length ?? 0,
    merges: [],
    colWidths: [],
  };
}

function makeRange(startRow: number, startCol: number, endRow: number, endCol: number): CellRange {
  return { startRow, startCol, endRow, endCol };
}

describe('evaluateConditionalFormats', () => {
  describe('greaterThan', () => {
    it('applies style when value is above threshold', () => {
      const rule: ConditionalFormatRule = {
        type: 'greaterThan',
        range: makeRange(0, 0, 2, 2),
        values: [50],
        style: { bgColor: '#ff0000' },
      };
      const sheetData = makeSheetData([['60'], ['70'], ['80']]);
      const result = evaluateConditionalFormats(0, 0, 60, [rule], sheetData);
      expect(result).toEqual({ bgColor: '#ff0000' });
    });

    it('does not apply when value equals threshold', () => {
      const rule: ConditionalFormatRule = {
        type: 'greaterThan',
        range: makeRange(0, 0, 0, 0),
        values: [50],
        style: { bgColor: '#ff0000' },
      };
      const sheetData = makeSheetData([['50']]);
      const result = evaluateConditionalFormats(0, 0, 50, [rule], sheetData);
      expect(result).toBeUndefined();
    });

    it('does not apply when value is below threshold', () => {
      const rule: ConditionalFormatRule = {
        type: 'greaterThan',
        range: makeRange(0, 0, 0, 0),
        values: [50],
        style: { bgColor: '#ff0000' },
      };
      const result = evaluateConditionalFormats(0, 0, 30, [rule], makeSheetData([['30']]));
      expect(result).toBeUndefined();
    });
  });

  describe('lessThan', () => {
    it('applies style when value is below threshold', () => {
      const rule: ConditionalFormatRule = {
        type: 'lessThan',
        range: makeRange(0, 0, 0, 0),
        values: [50],
        style: { fontColor: '#0000ff' },
      };
      const result = evaluateConditionalFormats(0, 0, 20, [rule], makeSheetData([['20']]));
      expect(result).toEqual({ fontColor: '#0000ff' });
    });

    it('does not apply when value equals or exceeds threshold', () => {
      const rule: ConditionalFormatRule = {
        type: 'lessThan',
        range: makeRange(0, 0, 0, 0),
        values: [50],
        style: { fontColor: '#0000ff' },
      };
      expect(evaluateConditionalFormats(0, 0, 50, [rule], makeSheetData([['50']]))).toBeUndefined();
      expect(evaluateConditionalFormats(0, 0, 60, [rule], makeSheetData([['60']]))).toBeUndefined();
    });
  });

  describe('between', () => {
    it('applies style when value is in range', () => {
      const rule: ConditionalFormatRule = {
        type: 'between',
        range: makeRange(0, 0, 0, 0),
        values: [10, 90],
        style: { bold: true },
      };
      const result = evaluateConditionalFormats(0, 0, 50, [rule], makeSheetData([['50']]));
      expect(result).toEqual({ bold: true });
    });

    it('applies style at boundaries (inclusive)', () => {
      const rule: ConditionalFormatRule = {
        type: 'between',
        range: makeRange(0, 0, 0, 0),
        values: [10, 90],
        style: { bold: true },
      };
      expect(evaluateConditionalFormats(0, 0, 10, [rule], makeSheetData([['10']]))).toEqual({ bold: true });
      expect(evaluateConditionalFormats(0, 0, 90, [rule], makeSheetData([['90']]))).toEqual({ bold: true });
    });

    it('does not apply when value is outside range', () => {
      const rule: ConditionalFormatRule = {
        type: 'between',
        range: makeRange(0, 0, 0, 0),
        values: [10, 90],
        style: { bold: true },
      };
      expect(evaluateConditionalFormats(0, 0, 5, [rule], makeSheetData([['5']]))).toBeUndefined();
      expect(evaluateConditionalFormats(0, 0, 95, [rule], makeSheetData([['95']]))).toBeUndefined();
    });
  });

  describe('equalTo', () => {
    it('applies style when value matches', () => {
      const rule: ConditionalFormatRule = {
        type: 'equalTo',
        range: makeRange(0, 0, 0, 0),
        values: ['Active'],
        style: { bgColor: '#00ff00' },
      };
      const result = evaluateConditionalFormats(0, 0, 'Active', [rule], makeSheetData([['Active']]));
      expect(result).toEqual({ bgColor: '#00ff00' });
    });

    it('does not apply when value does not match', () => {
      const rule: ConditionalFormatRule = {
        type: 'equalTo',
        range: makeRange(0, 0, 0, 0),
        values: ['Active'],
        style: { bgColor: '#00ff00' },
      };
      const result = evaluateConditionalFormats(0, 0, 'Inactive', [rule], makeSheetData([['Inactive']]));
      expect(result).toBeUndefined();
    });

    it('matches numeric values as strings', () => {
      const rule: ConditionalFormatRule = {
        type: 'equalTo',
        range: makeRange(0, 0, 0, 0),
        values: [42],
        style: { bgColor: '#ffff00' },
      };
      const result = evaluateConditionalFormats(0, 0, 42, [rule], makeSheetData([[42]]));
      expect(result).toEqual({ bgColor: '#ffff00' });
    });
  });

  describe('textContains', () => {
    it('applies style when cell contains substring (case insensitive)', () => {
      const rule: ConditionalFormatRule = {
        type: 'textContains',
        range: makeRange(0, 0, 0, 0),
        values: ['urgent'],
        style: { fontColor: '#ff0000' },
      };
      const result = evaluateConditionalFormats(0, 0, 'URGENT: Please reply', [rule], makeSheetData([['URGENT: Please reply']]));
      expect(result).toEqual({ fontColor: '#ff0000' });
    });

    it('does not apply when substring is not found', () => {
      const rule: ConditionalFormatRule = {
        type: 'textContains',
        range: makeRange(0, 0, 0, 0),
        values: ['urgent'],
        style: { fontColor: '#ff0000' },
      };
      const result = evaluateConditionalFormats(0, 0, 'Normal message', [rule], makeSheetData([['Normal message']]));
      expect(result).toBeUndefined();
    });

    it('does not apply when substring is empty', () => {
      const rule: ConditionalFormatRule = {
        type: 'textContains',
        range: makeRange(0, 0, 0, 0),
        values: [''],
        style: { fontColor: '#ff0000' },
      };
      const result = evaluateConditionalFormats(0, 0, 'Anything', [rule], makeSheetData([['Anything']]));
      expect(result).toBeUndefined();
    });
  });

  describe('top10', () => {
    it('applies style to values in top N', () => {
      const data = [[100], [50], [75], [25], [90]];
      const sheetData = makeSheetData(data);
      const rule: ConditionalFormatRule = {
        type: 'top10',
        range: makeRange(0, 0, 4, 0),
        values: [2],
        style: { bgColor: '#ffcccc' },
      };
      // Top 2: 100, 90. So rows 0 and 4 get the style.
      expect(evaluateConditionalFormats(0, 0, 100, [rule], sheetData)).toEqual({ bgColor: '#ffcccc' });
      expect(evaluateConditionalFormats(4, 0, 90, [rule], sheetData)).toEqual({ bgColor: '#ffcccc' });
      expect(evaluateConditionalFormats(1, 0, 50, [rule], sheetData)).toBeUndefined();
    });

    it('uses default N=10 when not specified', () => {
      const data = Array.from({ length: 15 }, (_, i) => [100 - i]);
      const sheetData = makeSheetData(data);
      const rule: ConditionalFormatRule = {
        type: 'top10',
        range: makeRange(0, 0, 14, 0),
        style: { bgColor: '#ffcccc' },
      };
      // Top 10: 100, 99, 98, 97, 96, 95, 94, 93, 92, 91
      expect(evaluateConditionalFormats(0, 0, 100, [rule], sheetData)).toEqual({ bgColor: '#ffcccc' });
      expect(evaluateConditionalFormats(9, 0, 91, [rule], sheetData)).toEqual({ bgColor: '#ffcccc' });
      expect(evaluateConditionalFormats(10, 0, 90, [rule], sheetData)).toBeUndefined();
    });
  });

  describe('bottom10', () => {
    it('applies style to values in bottom N', () => {
      const data = [[100], [50], [75], [25], [90]];
      const sheetData = makeSheetData(data);
      const rule: ConditionalFormatRule = {
        type: 'bottom10',
        range: makeRange(0, 0, 4, 0),
        values: [2],
        style: { bgColor: '#ccccff' },
      };
      // Bottom 2: 25, 50. So rows 1 and 3 get the style.
      expect(evaluateConditionalFormats(3, 0, 25, [rule], sheetData)).toEqual({ bgColor: '#ccccff' });
      expect(evaluateConditionalFormats(1, 0, 50, [rule], sheetData)).toEqual({ bgColor: '#ccccff' });
      expect(evaluateConditionalFormats(0, 0, 100, [rule], sheetData)).toBeUndefined();
    });
  });

  describe('colorScale', () => {
    it('applies 2-color gradient based on value position', () => {
      const data = [[10], [50], [90]];
      const sheetData = makeSheetData(data);
      const rule: ConditionalFormatRule = {
        type: 'colorScale',
        range: makeRange(0, 0, 2, 0),
        colorScale: ['#000000', '#ffffff'],
      };
      const result = evaluateConditionalFormats(1, 0, 50, [rule], sheetData);
      expect(result).toBeDefined();
      expect(result?.bgColor).toBeDefined();
      expect(result?.bgColor).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('returns min color for minimum value in 2-color scale', () => {
      const data = [[0], [100]];
      const sheetData = makeSheetData(data);
      const rule: ConditionalFormatRule = {
        type: 'colorScale',
        range: makeRange(0, 0, 1, 0),
        colorScale: ['#ff0000', '#0000ff'],
      };
      const result = evaluateConditionalFormats(0, 0, 0, [rule], sheetData);
      expect(result?.bgColor).toBe('#ff0000');
    });

    it('returns max color for maximum value in 2-color scale', () => {
      const data = [[0], [100]];
      const sheetData = makeSheetData(data);
      const rule: ConditionalFormatRule = {
        type: 'colorScale',
        range: makeRange(0, 0, 1, 0),
        colorScale: ['#ff0000', '#0000ff'],
      };
      const result = evaluateConditionalFormats(1, 0, 100, [rule], sheetData);
      expect(result?.bgColor).toBe('#0000ff');
    });

    it('returns undefined when colorScale has fewer than 2 colors', () => {
      const rule: ConditionalFormatRule = {
        type: 'colorScale',
        range: makeRange(0, 0, 0, 0),
        colorScale: ['#ff0000'],
      };
      const result = evaluateConditionalFormats(0, 0, 50, [rule], makeSheetData([[50]]));
      expect(result).toBeUndefined();
    });

    it('returns undefined for non-numeric cell in colorScale', () => {
      const rule: ConditionalFormatRule = {
        type: 'colorScale',
        range: makeRange(0, 0, 1, 0),
        colorScale: ['#ff0000', '#0000ff'],
      };
      const sheetData = makeSheetData([['text'], [100]]);
      const result = evaluateConditionalFormats(0, 0, 'text', [rule], sheetData);
      expect(result).toBeUndefined();
    });
  });

  describe('dataBar', () => {
    it('returns bar color for numeric cell', () => {
      const data = [[10], [50], [90]];
      const sheetData = makeSheetData(data);
      const rule: ConditionalFormatRule = {
        type: 'dataBar',
        range: makeRange(0, 0, 2, 0),
        barColor: '#4285f4',
      };
      const result = evaluateConditionalFormats(1, 0, 50, [rule], sheetData);
      expect(result?.bgColor).toBe('#4285f4');
    });

    it('uses default bar color when not specified', () => {
      const data = [[10], [90]];
      const sheetData = makeSheetData(data);
      const rule: ConditionalFormatRule = {
        type: 'dataBar',
        range: makeRange(0, 0, 1, 0),
      };
      const result = evaluateConditionalFormats(0, 0, 10, [rule], sheetData);
      expect(result?.bgColor).toBe('#4285f4');
    });
  });

  describe('cell outside range', () => {
    it('returns undefined when row is before range', () => {
      const rule: ConditionalFormatRule = {
        type: 'greaterThan',
        range: makeRange(2, 0, 5, 5),
        values: [0],
        style: { bgColor: '#ff0000' },
      };
      const sheetData = makeSheetData([['10'], ['20'], ['30'], ['40'], ['50'], ['60']]);
      const result = evaluateConditionalFormats(0, 0, 100, [rule], sheetData);
      expect(result).toBeUndefined();
    });

    it('returns undefined when col is outside range', () => {
      const rule: ConditionalFormatRule = {
        type: 'equalTo',
        range: makeRange(0, 1, 0, 2),
        values: ['X'],
        style: { bgColor: '#ff0000' },
      };
      const sheetData = makeSheetData([['A', 'X', 'C']]);
      const result = evaluateConditionalFormats(0, 0, 'X', [rule], sheetData);
      expect(result).toBeUndefined();
    });
  });

  describe('multiple overlapping rules', () => {
    it('last matching rule wins (merges styles)', () => {
      const rule1: ConditionalFormatRule = {
        type: 'greaterThan',
        range: makeRange(0, 0, 0, 0),
        values: [0],
        style: { bgColor: '#ff0000' },
      };
      const rule2: ConditionalFormatRule = {
        type: 'greaterThan',
        range: makeRange(0, 0, 0, 0),
        values: [50],
        style: { fontColor: '#0000ff' },
      };
      const sheetData = makeSheetData([['100']]);
      const result = evaluateConditionalFormats(0, 0, 100, [rule1, rule2], sheetData);
      // Both match; later rule's style is merged over earlier
      expect(result).toEqual({ bgColor: '#ff0000', fontColor: '#0000ff' });
    });

    it('later rule overrides same property from earlier', () => {
      const rule1: ConditionalFormatRule = {
        type: 'greaterThan',
        range: makeRange(0, 0, 0, 0),
        values: [0],
        style: { bgColor: '#ff0000' },
      };
      const rule2: ConditionalFormatRule = {
        type: 'greaterThan',
        range: makeRange(0, 0, 0, 0),
        values: [50],
        style: { bgColor: '#00ff00' },
      };
      const sheetData = makeSheetData([['100']]);
      const result = evaluateConditionalFormats(0, 0, 100, [rule1, rule2], sheetData);
      expect(result?.bgColor).toBe('#00ff00');
    });
  });
});

describe('interpolateColor', () => {
  it('returns first color at ratio 0 (2-color)', () => {
    const result = interpolateColor(['#ff0000', '#0000ff'], 0);
    expect(result).toBe('#ff0000');
  });

  it('returns second color at ratio 1 (2-color)', () => {
    const result = interpolateColor(['#ff0000', '#0000ff'], 1);
    expect(result).toBe('#0000ff');
  });

  it('blends at ratio 0.5 (2-color)', () => {
    const result = interpolateColor(['#000000', '#ffffff'], 0.5);
    expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    // Should be gray-ish (128, 128, 128)
    const r = parseInt(result.slice(1, 3), 16);
    const g = parseInt(result.slice(3, 5), 16);
    const b = parseInt(result.slice(5, 7), 16);
    expect(r).toBeGreaterThanOrEqual(120);
    expect(r).toBeLessThanOrEqual(140);
    expect(g).toBe(r);
    expect(b).toBe(r);
  });

  it('clamps ratio below 0 to 0', () => {
    const result = interpolateColor(['#ff0000', '#0000ff'], -0.5);
    expect(result).toBe('#ff0000');
  });

  it('clamps ratio above 1 to 1', () => {
    const result = interpolateColor(['#ff0000', '#0000ff'], 1.5);
    expect(result).toBe('#0000ff');
  });

  it('handles 3-color gradient: ratio 0 returns first color', () => {
    const result = interpolateColor(['#ff0000', '#00ff00', '#0000ff'], 0);
    expect(result).toBe('#ff0000');
  });

  it('handles 3-color gradient: ratio 0.5 blends middle', () => {
    const result = interpolateColor(['#ff0000', '#00ff00', '#0000ff'], 0.5);
    expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    // At 0.5 we're at the midpoint between color[1] and color[2] in the 3-color logic
    // (clampedRatio - 0.5) * 2 = 0, so we get color[1]
    expect(result).toBe('#00ff00');
  });

  it('handles 3-color gradient: ratio 1 returns third color', () => {
    const result = interpolateColor(['#ff0000', '#00ff00', '#0000ff'], 1);
    expect(result).toBe('#0000ff');
  });

  it('returns first color when colors array has one element', () => {
    const result = interpolateColor(['#abcdef'], 0.5);
    expect(result).toBe('#abcdef');
  });
});
