import { describe, it, expect } from 'vitest';
import { recalculateSheet, normalizeFormula, buildFunctionTable } from '../recalculate';
import { FUNCTIONS } from '../functions';
import type { SheetData } from '../../types';

function sheet(data: SheetData['data'], formulas: Record<string, string>): SheetData {
  return { data, rows: data.length, cols: Math.max(...data.map((r) => r.length)), merges: [], colWidths: [], formulas };
}

describe('recalculateSheet', () => {
  it('writes formula results into data', () => {
    const s = recalculateSheet(sheet([[1, 2, null]], { '0,2': '=A1+B1' }));
    expect(s.data[0][2]).toBe(3);
  });

  it('returns the same object when there are no formulas', () => {
    const s = sheet([[1]], {});
    expect(recalculateSheet(s)).toBe(s);
    const plain: SheetData = { data: [[1]], rows: 1, cols: 1, merges: [], colWidths: [] };
    expect(recalculateSheet(plain)).toBe(plain);
  });

  it('returns the same object when results are unchanged', () => {
    const s = recalculateSheet(sheet([[1, 2, null]], { '0,2': '=A1+B1' }));
    expect(recalculateSheet(s)).toBe(s);
  });

  it('does not mutate the input sheet', () => {
    const input = sheet([[1, 2, null]], { '0,2': '=A1+B1' });
    recalculateSheet(input);
    expect(input.data[0][2]).toBeNull();
  });

  it('evaluates formulas that depend on other formulas, in any order', () => {
    const s = recalculateSheet(sheet([[null, null, 5]], { '0,0': '=B1*2', '0,1': '=C1+1' }));
    expect(s.data[0]).toEqual([12, 6, 5]);
  });

  it('marks circular references as #REF!', () => {
    const s = recalculateSheet(sheet([[null, null]], { '0,0': '=B1', '0,1': '=A1' }));
    expect(s.data[0][0]).toBe('#REF!');
    expect(s.data[0][1]).toBe('#REF!');
  });

  it('accepts lower-case formulas but keeps string literals as written', () => {
    const s = recalculateSheet(sheet([[2, 3, null, null]], { '0,2': '=sum(a1:b1)', '0,3': '=CONCATENATE("ab", "Cd")' }));
    expect(s.data[0][2]).toBe(5);
    expect(s.data[0][3]).toBe('abCd');
  });

  it('calls custom functions with evaluated arguments (LOOKUP against a table)', () => {
    const coa: Record<string, Record<string, string>> = { Revenue: { category: 'Income' } };
    const LOOKUP = (value: unknown, key: unknown, dest: unknown) => {
      expect(key).toBe('label');
      return coa[String(value)]?.[String(dest)] ?? '';
    };
    const s = recalculateSheet(
      sheet([['Revenue', null]], { '0,1': '=LOOKUP(A1,"label","category")' }),
      { lookup: LOOKUP },
    );
    expect(s.data[0][1]).toBe('Income');
  });

  it('turns a throwing custom function into #VALUE!', () => {
    const s = recalculateSheet(sheet([[null]], { '0,0': '=BOOM()' }), {
      BOOM: () => {
        throw new Error('nope');
      },
    });
    expect(s.data[0][0]).toBe('#VALUE!');
  });

  it('reports unknown functions', () => {
    const s = recalculateSheet(sheet([[null]], { '0,0': '=NOPE(1)' }));
    expect(String(s.data[0][0])).toMatch(/^#NAME\?/);
  });

  it('grows the sheet when a formula sits past the data', () => {
    const s = recalculateSheet({ data: [[1]], rows: 1, cols: 1, merges: [], colWidths: [], formulas: { '2,3': '=A1*10' } });
    expect(s.data[2][3]).toBe(10);
    expect(s.rows).toBe(3);
    expect(s.cols).toBe(4);
  });

  it('shows the first value of a range result', () => {
    const s = recalculateSheet(sheet([[7, 8, null]], { '0,2': '=A1:B1' }));
    expect(s.data[0][2]).toBe(7);
  });
});

describe('normalizeFormula', () => {
  it('upper-cases outside string literals only', () => {
    expect(normalizeFormula('=if(a1="yes","ok",b2)')).toBe('=IF(A1="yes","ok",B2)');
  });
});

describe('buildFunctionTable', () => {
  it('returns the built-ins untouched without custom functions', () => {
    expect(buildFunctionTable(undefined)).toBe(FUNCTIONS);
  });

  it('lets a custom function replace a built-in', () => {
    const table = buildFunctionTable({ sum: () => 42 });
    expect(table.SUM()).toBe(42);
    expect(FUNCTIONS.SUM(1, 2)).toBe(3);
  });
});
