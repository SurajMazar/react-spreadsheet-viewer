import { describe, it, expect } from 'vitest';
import { evaluate, type CellResolver } from '../evaluator';
import { parseFormula } from '../parser';
import type { FormulaValue } from '../functions';

/** Mock CellResolver for tests. Row/col are 0-based (A1 = row 0, col 0). */
function createMockResolver(grid: FormulaValue[][]): CellResolver {
  return {
    getCellValue(row: number, col: number): FormulaValue {
      const r = grid[row];
      if (!r) return null;
      return r[col] ?? null;
    },
    getSheetRows(): number {
      return grid.length;
    },
    getSheetCols(): number {
      return grid.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
    },
  };
}

function evalFormula(formula: string, resolver: CellResolver, visiting?: Set<string>): FormulaValue {
  const ast = parseFormula(formula);
  return evaluate(ast, resolver, visiting);
}

// =============================================
// Cell Reference Resolution
// =============================================
describe('Cell reference resolution', () => {
  it('resolves A1 (row 0, col 0) to actual value', () => {
    const resolver = createMockResolver([[42, 10], [100]]);
    expect(evalFormula('=A1', resolver)).toBe(42);
  });

  it('resolves B1 (row 0, col 1) to actual value', () => {
    const resolver = createMockResolver([[42, 10], [100]]);
    expect(evalFormula('=B1', resolver)).toBe(10);
  });

  it('resolves A2 (row 1, col 0) to actual value', () => {
    const resolver = createMockResolver([[42, 10], [100]]);
    expect(evalFormula('=A2', resolver)).toBe(100);
  });

  it('resolves $A$1 absolute reference', () => {
    const resolver = createMockResolver([[99]]);
    expect(evalFormula('=$A$1', resolver)).toBe(99);
  });

  it('returns null for empty cell', () => {
    const resolver = createMockResolver([[]]);
    expect(evalFormula('=A1', resolver)).toBeNull();
  });

  it('resolves ranges A1:A5 to array of values', () => {
    const resolver = createMockResolver([
      [1],
      [2],
      [3],
      [4],
      [5],
    ]);
    const result = evalFormula('=A1:A5', resolver);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([[1], [2], [3], [4], [5]]);
  });

  it('resolves range A1:B2 to 2D array', () => {
    const resolver = createMockResolver([
      [1, 2],
      [3, 4],
    ]);
    const result = evalFormula('=A1:B2', resolver);
    expect(result).toEqual([[1, 2], [3, 4]]);
  });

  it('returns #REF! for circular references (use visiting set)', () => {
    const resolver = createMockResolver([[1]]);
    const visiting = new Set<string>(['0,0']);
    const ast = parseFormula('=A1');
    expect(evaluate(ast, resolver, visiting)).toBe('#REF!');
  });

  it('evaluates parser error node to #ERROR!', () => {
    // Parser returns error node for formula not starting with =
    const ast = parseFormula('x');
    const resolver = createMockResolver([[]]);
    expect(evaluate(ast, resolver)).toMatch(/^#ERROR!/);
  });
});

// =============================================
// Arithmetic Evaluation
// =============================================
describe('Arithmetic evaluation', () => {
  const resolver = createMockResolver([[]]);

  it('=1+2 → 3', () => {
    expect(evalFormula('=1+2', resolver)).toBe(3);
  });

  it('=10-3 → 7', () => {
    expect(evalFormula('=10-3', resolver)).toBe(7);
  });

  it('=4*5 → 20', () => {
    expect(evalFormula('=4*5', resolver)).toBe(20);
  });

  it('=10/3 → 3.333...', () => {
    const result = evalFormula('=10/3', resolver);
    expect(typeof result).toBe('number');
    expect((result as number) - 3.3333333333333335).toBeLessThan(0.0001);
    expect((result as number) - 3.3333333333333335).toBeGreaterThan(-0.0001);
  });

  it('=2^3 → 8', () => {
    expect(evalFormula('=2^3', resolver)).toBe(8);
  });

  it('=10/0 → #DIV/0!', () => {
    expect(evalFormula('=10/0', resolver)).toBe('#DIV/0!');
  });

  it('=-5 → -5 (unary minus)', () => {
    expect(evalFormula('=-5', resolver)).toBe(-5);
  });

  it('=-(-3) → 3', () => {
    expect(evalFormula('=-(-3)', resolver)).toBe(3);
  });

  it('=1+2*3 → 7 (operator precedence)', () => {
    expect(evalFormula('=1+2*3', resolver)).toBe(7);
  });

  it('=(1+2)*3 → 9', () => {
    expect(evalFormula('=(1+2)*3', resolver)).toBe(9);
  });
});

// =============================================
// Comparison Evaluation
// =============================================
describe('Comparison evaluation', () => {
  const resolver = createMockResolver([[]]);

  it('=5>3 → true', () => {
    expect(evalFormula('=5>3', resolver)).toBe(true);
  });

  it('=5<3 → false', () => {
    expect(evalFormula('=5<3', resolver)).toBe(false);
  });

  it('=5=5 → true', () => {
    expect(evalFormula('=5=5', resolver)).toBe(true);
  });

  it('=5<>3 → true', () => {
    expect(evalFormula('=5<>3', resolver)).toBe(true);
  });

  it('=5<=5 → true', () => {
    expect(evalFormula('=5<=5', resolver)).toBe(true);
  });

  it('=5>=5 → true', () => {
    expect(evalFormula('=5>=5', resolver)).toBe(true);
  });

  it('="a"<"b" → true (string comparison)', () => {
    expect(evalFormula('="a"<"b"', resolver)).toBe(true);
  });
});

// =============================================
// String Concatenation
// =============================================
describe('String concatenation', () => {
  const resolver = createMockResolver([[]]);

  it('="hello"&" "&"world" → "hello world"', () => {
    expect(evalFormula('="hello"&" "&"world"', resolver)).toBe('hello world');
  });

  it('=1&2 → "12"', () => {
    expect(evalFormula('=1&2', resolver)).toBe('12');
  });
});

// =============================================
// Function Calls
// =============================================
describe('Function calls', () => {
  const resolver = createMockResolver([[]]);

  it('=SUM(1,2,3) → 6', () => {
    expect(evalFormula('=SUM(1,2,3)', resolver)).toBe(6);
  });

  it('=SUM(A1:A3) with cell values', () => {
    const r = createMockResolver([[1], [2], [3]]);
    expect(evalFormula('=SUM(A1:A3)', r)).toBe(6);
  });

  it('=IF(1,"yes","no") → "yes" (truthy condition)', () => {
    expect(evalFormula('=IF(1,"yes","no")', resolver)).toBe('yes');
  });

  it('=IF(0,"yes","no") → "no" (falsy condition)', () => {
    expect(evalFormula('=IF(0,"yes","no")', resolver)).toBe('no');
  });

  it('unknown function returns #NAME?', () => {
    const result = evalFormula('=UNKNOWNFUNC(1)', resolver);
    expect(typeof result).toBe('string');
    expect((result as string).startsWith('#NAME?')).toBe(true);
    expect((result as string)).toContain('UNKNOWNFUNC');
  });

  it('=AVERAGE(2,4,6) → 4', () => {
    expect(evalFormula('=AVERAGE(2,4,6)', resolver)).toBe(4);
  });

  it('=MIN(5,2,8,1) → 1', () => {
    expect(evalFormula('=MIN(5,2,8,1)', resolver)).toBe(1);
  });

  it('=MAX(5,2,8,1) → 8', () => {
    expect(evalFormula('=MAX(5,2,8,1)', resolver)).toBe(8);
  });
});

// =============================================
// Error Propagation
// =============================================
describe('Error propagation', () => {
  const resolver = createMockResolver([[]]);

  it('formula without = returns error node', () => {
    const ast = parseFormula('1+2');
    expect(ast.kind).toBe('error');
    expect(evaluate(ast, resolver)).toMatch(/^#ERROR!/);
  });

  it('#DIV/0! propagates as #VALUE! when used in arithmetic', () => {
    // 1+1/0 → 1/0 = #DIV/0!, then 1 + #DIV/0! → toNum("#DIV/0!") returns null → #VALUE!
    expect(evalFormula('=1+1/0', resolver)).toBe('#VALUE!');
  });

  it('division by zero returns #DIV/0!', () => {
    expect(evalFormula('=1/0', resolver)).toBe('#DIV/0!');
  });

  it('non-numeric in arithmetic returns #VALUE!', () => {
    expect(evalFormula('=1+"abc"', resolver)).toBe('#VALUE!');
  });

  it('unary minus on non-numeric returns #VALUE!', () => {
    expect(evalFormula('=-"x"', resolver)).toBe('#VALUE!');
  });
});
