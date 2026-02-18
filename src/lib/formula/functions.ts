/**
 * Built-in formula function library.
 * Each function receives an array of evaluated arguments (numbers, strings, arrays, etc.)
 */

export type FormulaValue = number | string | boolean | null | FormulaValue[];
export type FormulaFunction = (...args: FormulaValue[]) => FormulaValue;

/**
 * Flatten arrays and extract all numeric values from arguments.
 */
function flatNums(args: FormulaValue[]): number[] {
  const nums: number[] = [];
  for (const a of args) {
    if (Array.isArray(a)) {
      nums.push(...flatNums(a));
    } else if (typeof a === 'number') {
      nums.push(a);
    } else if (typeof a === 'boolean') {
      nums.push(a ? 1 : 0);
    } else if (typeof a === 'string') {
      const n = Number(a);
      if (!isNaN(n) && a.trim() !== '') nums.push(n);
    }
  }
  return nums;
}

function flatAll(args: FormulaValue[]): FormulaValue[] {
  const result: FormulaValue[] = [];
  for (const a of args) {
    if (Array.isArray(a)) {
      result.push(...flatAll(a));
    } else {
      result.push(a);
    }
  }
  return result;
}

// ===== Math Functions =====
export const SUM: FormulaFunction = (...args) => {
  const nums = flatNums(args);
  return nums.reduce((a, b) => a + b, 0);
};

export const AVERAGE: FormulaFunction = (...args) => {
  const nums = flatNums(args);
  if (nums.length === 0) return '#DIV/0!';
  return nums.reduce((a, b) => a + b, 0) / nums.length;
};

export const COUNT: FormulaFunction = (...args) => {
  return flatNums(args).length;
};

export const COUNTA: FormulaFunction = (...args) => {
  const all = flatAll(args);
  return all.filter((v) => v !== null && v !== '' && v !== undefined).length;
};

export const MIN: FormulaFunction = (...args) => {
  const nums = flatNums(args);
  if (nums.length === 0) return 0;
  return Math.min(...nums);
};

export const MAX: FormulaFunction = (...args) => {
  const nums = flatNums(args);
  if (nums.length === 0) return 0;
  return Math.max(...nums);
};

export const ABS: FormulaFunction = (val) => {
  const n = typeof val === 'number' ? val : Number(val);
  return isNaN(n) ? '#VALUE!' : Math.abs(n);
};

export const SQRT: FormulaFunction = (val) => {
  const n = typeof val === 'number' ? val : Number(val);
  if (isNaN(n) || n < 0) return '#VALUE!';
  return Math.sqrt(n);
};

export const POWER: FormulaFunction = (base, exp) => {
  const b = typeof base === 'number' ? base : Number(base);
  const e = typeof exp === 'number' ? exp : Number(exp);
  if (isNaN(b) || isNaN(e)) return '#VALUE!';
  return Math.pow(b, e);
};

export const ROUND: FormulaFunction = (val, digits) => {
  const n = typeof val === 'number' ? val : Number(val);
  const d = typeof digits === 'number' ? digits : Number(digits ?? 0);
  if (isNaN(n)) return '#VALUE!';
  const factor = Math.pow(10, d);
  return Math.round(n * factor) / factor;
};

// ===== Logical Functions =====
export const IF: FormulaFunction = (condition, trueVal, falseVal) => {
  return condition ? (trueVal ?? true) : (falseVal ?? false);
};

export const AND: FormulaFunction = (...args) => {
  const all = flatAll(args);
  return all.every((v) => !!v);
};

export const OR: FormulaFunction = (...args) => {
  const all = flatAll(args);
  return all.some((v) => !!v);
};

export const NOT: FormulaFunction = (val) => {
  return !val;
};

// ===== Text Functions =====
export const CONCATENATE: FormulaFunction = (...args) => {
  const all = flatAll(args);
  return all.map((v) => (v == null ? '' : String(v))).join('');
};

export const LEFT: FormulaFunction = (text, numChars) => {
  const s = String(text ?? '');
  const n = typeof numChars === 'number' ? numChars : Number(numChars ?? 1);
  return s.slice(0, Math.max(0, n));
};

export const RIGHT: FormulaFunction = (text, numChars) => {
  const s = String(text ?? '');
  const n = typeof numChars === 'number' ? numChars : Number(numChars ?? 1);
  return s.slice(-Math.max(1, n));
};

export const MID: FormulaFunction = (text, startPos, numChars) => {
  const s = String(text ?? '');
  const start = typeof startPos === 'number' ? startPos : Number(startPos ?? 1);
  const n = typeof numChars === 'number' ? numChars : Number(numChars ?? 1);
  return s.slice(start - 1, start - 1 + n);
};

export const LEN: FormulaFunction = (text) => {
  return String(text ?? '').length;
};

export const UPPER: FormulaFunction = (text) => {
  return String(text ?? '').toUpperCase();
};

export const LOWER: FormulaFunction = (text) => {
  return String(text ?? '').toLowerCase();
};

export const TRIM: FormulaFunction = (text) => {
  return String(text ?? '').trim();
};

// ===== Lookup Functions =====
export const VLOOKUP: FormulaFunction = (searchKey, rangeArg, colIndex, exactMatch) => {
  if (!Array.isArray(rangeArg)) return '#VALUE!';
  const col = typeof colIndex === 'number' ? colIndex : Number(colIndex ?? 1);
  const exact = exactMatch !== false; // default to exact

  for (const row of rangeArg) {
    if (!Array.isArray(row)) continue;
    if (exact) {
      if (String(row[0]) === String(searchKey)) {
        return row[col - 1] ?? '#REF!';
      }
    } else {
      // Approximate match not fully implemented; use exact
      if (String(row[0]) === String(searchKey)) {
        return row[col - 1] ?? '#REF!';
      }
    }
  }
  return '#N/A';
};

export const HLOOKUP: FormulaFunction = (searchKey, rangeArg, rowIndex, exactMatch) => {
  if (!Array.isArray(rangeArg)) return '#VALUE!';
  const rowIdx = typeof rowIndex === 'number' ? rowIndex : Number(rowIndex ?? 1);
  const exact = exactMatch !== false;

  // The first row is searched for the key
  const firstRow = Array.isArray(rangeArg[0]) ? rangeArg[0] : rangeArg;
  for (let c = 0; c < firstRow.length; c++) {
    if (exact && String(firstRow[c]) === String(searchKey)) {
      const targetRow = Array.isArray(rangeArg[rowIdx - 1]) ? rangeArg[rowIdx - 1] : null;
      if (!targetRow || !Array.isArray(targetRow)) return '#REF!';
      return targetRow[c] ?? '#REF!';
    }
  }
  return '#N/A';
};

export const INDEX: FormulaFunction = (rangeArg, rowNum, colNum) => {
  if (!Array.isArray(rangeArg)) return '#VALUE!';
  const r = typeof rowNum === 'number' ? rowNum : Number(rowNum ?? 1);
  const c = typeof colNum === 'number' ? colNum : Number(colNum ?? 1);
  const row = Array.isArray(rangeArg[r - 1]) ? rangeArg[r - 1] : null;
  if (!row || !Array.isArray(row)) return '#REF!';
  return row[c - 1] ?? '#REF!';
};

export const MATCH: FormulaFunction = (searchKey, rangeArg, matchType) => {
  if (!Array.isArray(rangeArg)) return '#VALUE!';
  const mt = typeof matchType === 'number' ? matchType : Number(matchType ?? 0);

  // Flatten the range to 1D
  const flat = flatAll(rangeArg);

  if (mt === 0) {
    // Exact match
    for (let i = 0; i < flat.length; i++) {
      if (String(flat[i]) === String(searchKey)) return i + 1;
    }
    return '#N/A';
  }

  // mt=1 (sorted ascending) or mt=-1 (sorted descending) — simplified
  for (let i = 0; i < flat.length; i++) {
    if (String(flat[i]) === String(searchKey)) return i + 1;
  }
  return '#N/A';
};

// ===== Function Registry =====
export const FUNCTIONS: Record<string, FormulaFunction> = {
  SUM, AVERAGE, COUNT, COUNTA, MIN, MAX, ABS, SQRT, POWER, ROUND,
  IF, AND, OR, NOT,
  CONCATENATE, LEFT, RIGHT, MID, LEN, UPPER, LOWER, TRIM,
  VLOOKUP, HLOOKUP, INDEX, MATCH,
};
