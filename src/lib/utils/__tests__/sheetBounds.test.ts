import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  DEFAULT_SHEET_LIMITS,
  clipMerges,
  exceedsSheetLimits,
  findUsedRange,
  planSheetBounds,
  rangeCellCount,
  resolveSheetLimits,
  type SheetRange,
} from '../sheetBounds';

const decode = XLSX.utils.decode_cell;
const range = (ref: string): SheetRange => XLSX.utils.decode_range(ref);

/** A sparse worksheet-shaped object holding a value at each address. */
function sheetWith(ref: string, ...addresses: string[]): Record<string, unknown> {
  const ws: Record<string, unknown> = { '!ref': ref };
  for (const a of addresses) ws[a] = { t: 's', v: a };
  return ws;
}

describe('resolveSheetLimits', () => {
  it('defaults to Excel maxima for rows/cols and 2M cells', () => {
    expect(DEFAULT_SHEET_LIMITS).toEqual({ maxRows: 1_048_576, maxCols: 16_384, maxCells: 2_000_000 });
    expect(resolveSheetLimits()).toEqual(DEFAULT_SHEET_LIMITS);
    expect(resolveSheetLimits(null)).toEqual(DEFAULT_SHEET_LIMITS);
  });

  it('overrides only the limits given', () => {
    expect(resolveSheetLimits({ maxCells: 10 })).toEqual({ ...DEFAULT_SHEET_LIMITS, maxCells: 10 });
  });

  it('falls back to the default for unusable values and accepts Infinity', () => {
    expect(resolveSheetLimits({ maxRows: 0, maxCols: -5, maxCells: Number.NaN })).toEqual(DEFAULT_SHEET_LIMITS);
    expect(resolveSheetLimits({ maxCells: Infinity }).maxCells).toBe(Infinity);
  });
});

describe('findUsedRange', () => {
  it('returns the declared range unchanged for a normal, fully used sheet', () => {
    const ws = sheetWith('A1:C3', 'A1', 'C1', 'B2', 'C3');
    expect(findUsedRange(ws, range('A1:C3'), undefined, decode)).toEqual(range('A1:C3'));
  });

  it('keeps an offset start (data starting at C4)', () => {
    const ws = sheetWith('C4:E6', 'C4', 'E6');
    expect(findUsedRange(ws, range('C4:E6'), undefined, decode)).toEqual(range('C4:E6'));
  });

  it('keeps the declared start even when the first real cell is further in', () => {
    const ws = sheetWith('A1:Z100', 'C4', 'D5');
    expect(findUsedRange(ws, range('A1:Z100'), undefined, decode)).toEqual(range('A1:D5'));
  });

  it('shrinks a huge declared range to the cells the sheet holds', () => {
    const ws = sheetWith('A1:XFD1048576', 'A1', 'B2');
    expect(findUsedRange(ws, range('A1:XFD1048576'), undefined, decode)).toEqual(range('A1:B2'));
  });

  it('never grows past the declared range', () => {
    // A real cell outside !ref (malformed file) is ignored
    const ws = sheetWith('A1:B2', 'A1', 'Z99');
    expect(findUsedRange(ws, range('A1:B2'), undefined, decode)).toEqual(range('A1:A1'));
  });

  it('returns null when no real cell is inside the declared range', () => {
    expect(findUsedRange(sheetWith('A1'), range('A1'), undefined, decode)).toBeNull();
    expect(findUsedRange(sheetWith('C3:D4', 'A1'), range('C3:D4'), undefined, decode)).toBeNull();
  });

  it('ignores !-prefixed metadata keys', () => {
    const ws = sheetWith('A1:XFD1048576', 'A1');
    ws['!merges'] = [];
    ws['!cols'] = [];
    ws['!margins'] = {};
    expect(findUsedRange(ws, range('A1:XFD1048576'), undefined, decode)).toEqual(range('A1:A1'));
  });

  it('extends to the far corner of a merge anchored on a real cell', () => {
    const ws = sheetWith('A1:J10', 'A1', 'A2');
    const merges = [range('A1:E1')];
    expect(findUsedRange(ws, range('A1:J10'), merges, decode)).toEqual(range('A1:E2'));
  });

  it('does not extend for a merge anchored on an empty cell', () => {
    const ws = sheetWith('A1:J10', 'A1');
    expect(findUsedRange(ws, range('A1:J10'), [range('B5:J10')], decode)).toEqual(range('A1:A1'));
  });

  it('clamps a merge-extended range to the declared end', () => {
    const ws = sheetWith('A1:C3', 'A1');
    expect(findUsedRange(ws, range('A1:C3'), [range('A1:Z99')], decode)).toEqual(range('A1:C3'));
  });
});

describe('clipMerges', () => {
  it('keeps merges inside the range unchanged', () => {
    const { merges, mergedCells } = clipMerges([range('A1:B2'), range('C3:C4')], range('A1:D4'));
    expect(merges).toEqual([range('A1:B2'), range('C3:C4')]);
    expect(mergedCells).toBe(6);
  });

  it('clips ends that run past the range', () => {
    const { merges, mergedCells } = clipMerges([range('B2:Z99')], range('A1:D4'));
    expect(merges).toEqual([range('B2:D4')]);
    expect(mergedCells).toBe(9);
  });

  it('drops merges that start outside the range', () => {
    const { merges } = clipMerges([range('E1:F2'), range('A5:B6'), range('A1:A2')], range('A1:D4'));
    expect(merges).toEqual([range('A1:A2')]);
  });

  it('handles a missing merge list', () => {
    expect(clipMerges(undefined, range('A1:B2'))).toEqual({ merges: [], mergedCells: 0 });
  });
});

describe('rangeCellCount / exceedsSheetLimits', () => {
  it('counts rows of the range times columns from A', () => {
    expect(rangeCellCount(range('A1:C3'))).toBe(9);
    // Leading columns are padded in, leading rows are not
    expect(rangeCellCount(range('C4:E6'))).toBe(3 * 5);
  });

  it('flags rows, cols and cells over the limits, inclusive at the limit', () => {
    const limits = { maxRows: 10, maxCols: 5, maxCells: 20 };
    expect(exceedsSheetLimits(10, 2, limits)).toBe(false);
    expect(exceedsSheetLimits(11, 1, limits)).toBe(true);
    expect(exceedsSheetLimits(1, 5, limits)).toBe(false);
    expect(exceedsSheetLimits(1, 6, limits)).toBe(true);
    expect(exceedsSheetLimits(4, 5, limits)).toBe(false);
    expect(exceedsSheetLimits(5, 5, limits)).toBe(true);
  });
});

describe('planSheetBounds', () => {
  const plan = (
    ws: Record<string, unknown>,
    merges?: SheetRange[],
    limits = DEFAULT_SHEET_LIMITS,
  ) => planSheetBounds(ws, range(ws['!ref'] as string), merges, limits, decode);

  it('passes a normal sheet through with its merges', () => {
    const ws = sheetWith('A1:C3', 'A1', 'C3');
    expect(plan(ws, [range('A1:B1')])).toEqual({
      kind: 'ok',
      range: range('A1:C3'),
      merges: [range('A1:B1')],
    });
  });

  it('clamps a 1 KB-style attack: one cell in A1:XFD1048576', () => {
    const ws = sheetWith('A1:XFD1048576', 'A1');
    expect(plan(ws)).toEqual({ kind: 'ok', range: range('A1:A1'), merges: [] });
  });

  it('reports an empty sheet', () => {
    expect(plan(sheetWith('A1'))).toEqual({ kind: 'empty' });
  });

  it('refuses two far-apart real cells', () => {
    const ws = sheetWith('A1:XFD1048576', 'A1', 'XFD1048576');
    expect(plan(ws)).toMatchObject({ kind: 'tooLarge', reason: 'cells' });
  });

  it('refuses a giant merge anchored on a real cell', () => {
    const ws = sheetWith('A1:XFD1048576', 'A1');
    expect(plan(ws, [range('A1:XFD1048576')])).toMatchObject({ kind: 'tooLarge', reason: 'cells' });
  });

  it('refuses overlapping merges whose total area is over budget', () => {
    // 100x100 range = 10,000 cells, fine on its own; 300 copies of a
    // merge covering all of it is 3,000,000 merged cells.
    const ws = sheetWith('A1:CV100', 'A1', 'CV100');
    const merges = Array.from({ length: 300 }, () => range('A1:CV100'));
    expect(plan(ws, merges)).toMatchObject({ kind: 'tooLarge', reason: 'merges' });
  });

  it('drops a merge that starts past the clamped range', () => {
    const ws = sheetWith('A1:XFD1048576', 'A1', 'B2');
    expect(plan(ws, [range('Z50:XFD1048576')])).toEqual({ kind: 'ok', range: range('A1:B2'), merges: [] });
  });

  it('applies maxRows at and over the limit', () => {
    const ws = sheetWith('A1:A10', 'A10');
    expect(plan(ws, undefined, { ...DEFAULT_SHEET_LIMITS, maxRows: 10 }).kind).toBe('ok');
    expect(plan(ws, undefined, { ...DEFAULT_SHEET_LIMITS, maxRows: 9 })).toMatchObject({ kind: 'tooLarge', reason: 'rows' });
  });

  it('applies maxCols at and over the limit', () => {
    const ws = sheetWith('A1:E1', 'E1');
    expect(plan(ws, undefined, { ...DEFAULT_SHEET_LIMITS, maxCols: 5 }).kind).toBe('ok');
    expect(plan(ws, undefined, { ...DEFAULT_SHEET_LIMITS, maxCols: 4 })).toMatchObject({ kind: 'tooLarge', reason: 'cols' });
  });

  it('applies maxCells at and over the limit', () => {
    const ws = sheetWith('A1:D5', 'D5'); // 5 x 4 = 20 cells
    expect(plan(ws, undefined, { ...DEFAULT_SHEET_LIMITS, maxCells: 20 }).kind).toBe('ok');
    expect(plan(ws, undefined, { ...DEFAULT_SHEET_LIMITS, maxCells: 19 })).toMatchObject({ kind: 'tooLarge', reason: 'cells' });
  });

  it('counts padded leading columns against maxCells', () => {
    const ws = sheetWith('XFA1:XFD2', 'XFD2'); // 2 rows x 16,384 cols once padded
    expect(plan(ws, undefined, { ...DEFAULT_SHEET_LIMITS, maxCells: 32_768 }).kind).toBe('ok');
    expect(plan(ws, undefined, { ...DEFAULT_SHEET_LIMITS, maxCells: 32_767 }).kind).toBe('tooLarge');
  });
});
