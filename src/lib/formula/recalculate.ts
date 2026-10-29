/**
 * Sheet recalculation: evaluates every formula in `sheet.formulas` and writes
 * the results into `sheet.data`, so the grid, search, copy and export all see
 * the computed value without knowing formulas exist.
 *
 * Formula cells are evaluated on demand and memoised, so a formula that
 * depends on another formula always sees that formula's fresh result,
 * whatever order the cells are visited in. A formula that reaches itself
 * evaluates to `#REF!`.
 */

import type { CellValue, SheetData, SheetViewerFormulaFunction } from '../types';
import { parseFormula } from './parser';
import { evaluate, type CellResolver } from './evaluator';
import { FUNCTIONS, type FormulaFunction, type FormulaValue } from './functions';

/**
 * Upper-case a formula outside its string literals. The tokenizer only knows
 * upper-case names, while users (and stored payloads) write `=sum(a1:a3)`.
 */
export function normalizeFormula(formula: string): string {
  let out = '';
  let inString = false;
  for (const ch of formula) {
    if (ch === '"') inString = !inString;
    out += inString || ch === '"' ? ch : ch.toUpperCase();
  }
  return out;
}

/** The built-in functions plus the custom ones (custom names win). */
export function buildFunctionTable(
  custom: Record<string, SheetViewerFormulaFunction> | undefined,
): Record<string, FormulaFunction> {
  if (!custom || Object.keys(custom).length === 0) return FUNCTIONS;
  const table: Record<string, FormulaFunction> = { ...FUNCTIONS };
  for (const [name, fn] of Object.entries(custom)) {
    table[name.toUpperCase()] = fn as FormulaFunction;
  }
  return table;
}

/** Turn an evaluator result into something a cell can hold. */
function toCellValue(result: FormulaValue): CellValue {
  if (Array.isArray(result)) {
    // A range result in a single cell shows its top-left value, as Excel
    // does without dynamic arrays.
    let first: FormulaValue = result;
    while (Array.isArray(first)) first = first.length > 0 ? first[0] : null;
    return toCellValue(first);
  }
  if (result === undefined) return null;
  if (typeof result === 'number' && !Number.isFinite(result)) return '#NUM!';
  return result;
}

/**
 * Evaluate a sheet's formulas. Returns the same object when the sheet has no
 * formulas, or when every result is unchanged, so callers can skip a store
 * update.
 */
export function recalculateSheet(
  sheet: SheetData,
  customFunctions?: Record<string, SheetViewerFormulaFunction>,
): SheetData {
  if (!sheet.formulas) return sheet;
  const formulas: Record<string, string> = sheet.formulas;
  const keys = Object.keys(formulas);
  if (keys.length === 0) return sheet;

  const functions = buildFunctionTable(customFunctions);
  const results = new Map<string, CellValue>();
  const visiting = new Set<string>();

  const valueAt = (row: number, col: number): CellValue => {
    const key = `${row},${col}`;
    if (formulas[key] !== undefined) return evaluateCell(key);
    const v = sheet.data[row]?.[col];
    return v === undefined ? null : v;
  };

  const resolver: CellResolver = {
    getCellValue: (row, col) => valueAt(row, col) ?? null,
    getSheetRows: () => sheet.rows,
    getSheetCols: () => sheet.cols,
  };

  function evaluateCell(key: string): CellValue {
    const cached = results.get(key);
    if (cached !== undefined) return cached;
    if (visiting.has(key)) return '#REF!';

    visiting.add(key);
    let value: CellValue;
    try {
      const ast = parseFormula(normalizeFormula(formulas[key]));
      value = toCellValue(evaluate(ast, resolver, visiting, functions));
    } catch {
      value = '#VALUE!';
    }
    visiting.delete(key);
    results.set(key, value);
    return value;
  }

  for (const key of keys) evaluateCell(key);

  let changed = false;
  let maxRow = sheet.rows - 1;
  let maxCol = sheet.cols - 1;
  for (const [key, value] of results) {
    const [row, col] = key.split(',').map(Number);
    const prev = sheet.data[row]?.[col];
    if (prev !== value) changed = true;
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
  }
  if (!changed) return sheet;

  const data = sheet.data.slice();
  for (const [key, value] of results) {
    const [row, col] = key.split(',').map(Number);
    while (data.length <= row) data.push([]);
    const r = data[row] === sheet.data[row] ? data[row].slice() : data[row];
    while (r.length <= col) r.push(null);
    r[col] = value;
    data[row] = r;
  }

  return { ...sheet, data, rows: maxRow + 1, cols: maxCol + 1 };
}
