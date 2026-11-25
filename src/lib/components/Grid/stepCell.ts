import type { CommitMove } from './EditableCell';

/**
 * The cell one step from (row, col) in `move`'s direction, kept inside the
 * grid: a step off an edge stays on the edge cell.
 */
export function stepCell(
  row: number,
  col: number,
  move: CommitMove,
  rowCount: number,
  colCount: number
): { row: number; col: number } {
  const lastRow = Math.max(0, rowCount - 1);
  const lastCol = Math.max(0, colCount - 1);
  switch (move) {
    case 'up':
      return { row: Math.max(0, row - 1), col };
    case 'down':
      return { row: Math.min(lastRow, row + 1), col };
    case 'left':
      return { row, col: Math.max(0, col - 1) };
    case 'right':
      return { row, col: Math.min(lastCol, col + 1) };
  }
}
