/**
 * Formula evaluator: walks the AST and computes the result.
 *
 * Uses a CellResolver to look up cell values and detect circular references.
 */

import type { ASTNode } from './parser';
import { FUNCTIONS, type FormulaValue } from './functions';
import { colLetterToIndex } from '../utils/rangeParser';

/** Interface for resolving cell values from the sheet */
export interface CellResolver {
  getCellValue(row: number, col: number): FormulaValue;
  getSheetRows(): number;
  getSheetCols(): number;
}

/**
 * Evaluate an AST node to produce a value.
 * @param node The AST to evaluate
 * @param resolver Provides cell values
 * @param visiting Set of currently resolving cell keys (for circular ref detection)
 */
export function evaluate(
  node: ASTNode,
  resolver: CellResolver,
  visiting?: Set<string>,
): FormulaValue {
  switch (node.kind) {
    case 'number':
      return node.value;

    case 'string':
      return node.value;

    case 'error':
      return `#ERROR! ${node.message}`;

    case 'cellRef': {
      const { row, col } = parseCellRefString(node.ref);
      if (row === null || col === null) return '#REF!';

      const key = `${row},${col}`;
      if (visiting?.has(key)) return '#REF!';

      return resolver.getCellValue(row, col);
    }

    case 'rangeRef': {
      const start = parseCellRefString(node.start);
      const end = parseCellRefString(node.end);
      if (start.row === null || start.col === null || end.row === null || end.col === null) {
        return '#REF!';
      }

      // Build a 2D array of values for the range
      const result: FormulaValue[][] = [];
      for (let r = start.row; r <= end.row; r++) {
        const rowVals: FormulaValue[] = [];
        for (let c = start.col; c <= end.col; c++) {
          rowVals.push(resolver.getCellValue(r, c));
        }
        result.push(rowVals);
      }
      return result;
    }

    case 'unaryOp': {
      const operand = evaluate(node.operand, resolver, visiting);
      if (node.op === '-') {
        if (typeof operand === 'number') return -operand;
        const n = Number(operand);
        if (!isNaN(n)) return -n;
        return '#VALUE!';
      }
      return '#VALUE!';
    }

    case 'binaryOp':
      return evaluateBinaryOp(node.op, node.left, node.right, resolver, visiting);

    case 'functionCall': {
      const fn = FUNCTIONS[node.name.toUpperCase()];
      if (!fn) return `#NAME? ${node.name}`;
      const args = node.args.map((a) => evaluate(a, resolver, visiting));
      return fn(...args);
    }

    default:
      return '#ERROR!';
  }
}

function evaluateBinaryOp(
  op: string,
  leftNode: ASTNode,
  rightNode: ASTNode,
  resolver: CellResolver,
  visiting?: Set<string>,
): FormulaValue {
  const left = evaluate(leftNode, resolver, visiting);
  const right = evaluate(rightNode, resolver, visiting);

  // String concatenation
  if (op === '&') {
    return String(left ?? '') + String(right ?? '');
  }

  // Comparison operators (work on both numbers and strings)
  if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
    return evaluateComparison(op, left, right);
  }

  // Arithmetic: both sides must be numeric
  const l = toNum(left);
  const r = toNum(right);
  if (l === null || r === null) return '#VALUE!';

  switch (op) {
    case '+': return l + r;
    case '-': return l - r;
    case '*': return l * r;
    case '/': return r === 0 ? '#DIV/0!' : l / r;
    case '^': return Math.pow(l, r);
    default: return '#VALUE!';
  }
}

function evaluateComparison(op: string, left: FormulaValue, right: FormulaValue): boolean {
  // Try numeric comparison first
  const l = toNum(left);
  const r = toNum(right);
  if (l !== null && r !== null) {
    switch (op) {
      case '=': return l === r;
      case '<>': return l !== r;
      case '<': return l < r;
      case '>': return l > r;
      case '<=': return l <= r;
      case '>=': return l >= r;
    }
  }

  // String comparison
  const ls = String(left ?? '');
  const rs = String(right ?? '');
  switch (op) {
    case '=': return ls === rs;
    case '<>': return ls !== rs;
    case '<': return ls < rs;
    case '>': return ls > rs;
    case '<=': return ls <= rs;
    case '>=': return ls >= rs;
    default: return false;
  }
}

function toNum(val: FormulaValue): number | null {
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'string') {
    if (val.startsWith('#')) return null; // error value
    const n = Number(val);
    return isNaN(n) ? null : n;
  }
  return null;
}

/**
 * Parse a cell reference string like "A1", "$A$1" into { row, col }.
 */
function parseCellRefString(ref: string): { row: number | null; col: number | null } {
  // Strip $ signs
  const cleaned = ref.replace(/\$/g, '');
  const match = cleaned.match(/^([A-Z]+)(\d+)$/);
  if (!match) return { row: null, col: null };
  const col = colLetterToIndex(match[1]);
  const row = parseInt(match[2], 10) - 1; // 0-based
  return { row, col };
}
