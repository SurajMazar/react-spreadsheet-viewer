/**
 * Parse Excel-style cell references and ranges.
 * Supports: A1, A1:B10, A:A (full column), 1:1 (full row), and comma-separated multiples.
 */

import type { CellRange } from '../types';

const COL_REGEX = /^[A-Z]+$/;
const ROW_REGEX = /^\d+$/;
const CELL_REGEX = /^([A-Z]+)(\d+)$/;

/**
 * Convert column letter(s) to 0-based index.
 * A -> 0, B -> 1, ..., Z -> 25, AA -> 26, ...
 */
export function colLetterToIndex(letters: string): number {
  let index = 0;
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Convert 0-based column index to letter(s).
 * 0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA, ...
 */
export function colIndexToLetter(index: number): string {
  let result = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

/**
 * Parse a single cell reference (e.g., "A1").
 * Returns { row, col } (0-based).
 */
function parseCellRef(ref: string): { row: number; col: number } | null {
  const match = ref.match(CELL_REGEX);
  if (!match) return null;
  return {
    row: parseInt(match[2], 10) - 1,
    col: colLetterToIndex(match[1]),
  };
}

/**
 * Parse a range expression string into an array of range objects.
 * Each range: { startRow, startCol, endRow, endCol } (0-based, inclusive).
 */
export function parseRangeExpression(input: string, maxRows: number, maxCols: number): CellRange[] {
  if (!input || !input.trim()) return [];

  const parts = input.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const ranges: CellRange[] = [];

  for (const part of parts) {
    const range = parseSingleRange(part, maxRows, maxCols);
    if (range) ranges.push(range);
  }

  return ranges;
}

function parseSingleRange(part: string, maxRows: number, maxCols: number): CellRange | null {
  // Full column range like A:C
  const colRangeMatch = part.match(/^([A-Z]+):([A-Z]+)$/);
  if (colRangeMatch) {
    const sc = colLetterToIndex(colRangeMatch[1]);
    const ec = colLetterToIndex(colRangeMatch[2]);
    return {
      startRow: 0,
      startCol: Math.min(sc, ec),
      endRow: maxRows - 1,
      endCol: Math.max(sc, ec),
    };
  }

  // Single column like B
  if (COL_REGEX.test(part)) {
    const col = colLetterToIndex(part);
    return { startRow: 0, startCol: col, endRow: maxRows - 1, endCol: col };
  }

  // Full row range like 1:5
  const rowRangeMatch = part.match(/^(\d+):(\d+)$/);
  if (rowRangeMatch) {
    const sr = parseInt(rowRangeMatch[1], 10) - 1;
    const er = parseInt(rowRangeMatch[2], 10) - 1;
    return {
      startRow: Math.min(sr, er),
      startCol: 0,
      endRow: Math.max(sr, er),
      endCol: maxCols - 1,
    };
  }

  // Single row number
  if (ROW_REGEX.test(part)) {
    const row = parseInt(part, 10) - 1;
    return { startRow: row, startCol: 0, endRow: row, endCol: maxCols - 1 };
  }

  // Range like A1:B10
  if (part.includes(':')) {
    const [startStr, endStr] = part.split(':');
    const start = parseCellRef(startStr);
    const end = parseCellRef(endStr);
    if (start && end) {
      return {
        startRow: Math.min(start.row, end.row),
        startCol: Math.min(start.col, end.col),
        endRow: Math.max(start.row, end.row),
        endCol: Math.max(start.col, end.col),
      };
    }
    return null;
  }

  // Single cell like A1
  const cell = parseCellRef(part);
  if (cell) {
    return {
      startRow: cell.row,
      startCol: cell.col,
      endRow: cell.row,
      endCol: cell.col,
    };
  }

  return null;
}

/**
 * Check if a cell (row, col) is within any of the given ranges.
 */
export function isCellInRanges(row: number, col: number, ranges: CellRange[]): boolean {
  for (const r of ranges) {
    if (row >= r.startRow && row <= r.endRow && col >= r.startCol && col <= r.endCol) {
      return true;
    }
  }
  return false;
}

/**
 * Bounding box covering every given range. Returns null for an empty list.
 * Taking min/max over both corners normalizes non-normalized ranges for free.
 */
export function unionRanges(ranges: CellRange[]): CellRange | null {
  if (!ranges || ranges.length === 0) return null;

  let startRow = Infinity;
  let startCol = Infinity;
  let endRow = -Infinity;
  let endCol = -Infinity;

  for (const r of ranges) {
    startRow = Math.min(startRow, r.startRow, r.endRow);
    endRow = Math.max(endRow, r.startRow, r.endRow);
    startCol = Math.min(startCol, r.startCol, r.endCol);
    endCol = Math.max(endCol, r.startCol, r.endCol);
  }

  return { startRow, startCol, endRow, endCol };
}

export interface CellBorders {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

/**
 * Check if a cell is on the border of any range (for drawing range outlines).
 */
export function getCellBorderInRanges(row: number, col: number, ranges: CellRange[]): CellBorders {
  const borders: CellBorders = { top: false, bottom: false, left: false, right: false };

  for (const r of ranges) {
    if (row >= r.startRow && row <= r.endRow && col >= r.startCol && col <= r.endCol) {
      if (row === r.startRow) borders.top = true;
      if (row === r.endRow) borders.bottom = true;
      if (col === r.startCol) borders.left = true;
      if (col === r.endCol) borders.right = true;
    }
  }

  return borders;
}

/**
 * Get the display string for a range.
 */
export function rangeToString(range: CellRange): string {
  const start = `${colIndexToLetter(range.startCol)}${range.startRow + 1}`;
  const end = `${colIndexToLetter(range.endCol)}${range.endRow + 1}`;
  if (start === end) return start;
  return `${start}:${end}`;
}
