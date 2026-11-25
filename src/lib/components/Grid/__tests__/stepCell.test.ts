import { describe, it, expect } from 'vitest';
import { stepCell } from '../stepCell';

describe('stepCell', () => {
  it('steps one cell in each direction', () => {
    expect(stepCell(5, 5, 'up', 10, 10)).toEqual({ row: 4, col: 5 });
    expect(stepCell(5, 5, 'down', 10, 10)).toEqual({ row: 6, col: 5 });
    expect(stepCell(5, 5, 'left', 10, 10)).toEqual({ row: 5, col: 4 });
    expect(stepCell(5, 5, 'right', 10, 10)).toEqual({ row: 5, col: 6 });
  });

  it('stays on the edge cell at each edge of the grid', () => {
    expect(stepCell(0, 3, 'up', 10, 10)).toEqual({ row: 0, col: 3 });
    expect(stepCell(9, 3, 'down', 10, 10)).toEqual({ row: 9, col: 3 });
    expect(stepCell(3, 0, 'left', 10, 10)).toEqual({ row: 3, col: 0 });
    expect(stepCell(3, 9, 'right', 10, 10)).toEqual({ row: 3, col: 9 });
  });

  it('handles an empty grid without going negative', () => {
    expect(stepCell(0, 0, 'down', 0, 0)).toEqual({ row: 0, col: 0 });
    expect(stepCell(0, 0, 'right', 0, 0)).toEqual({ row: 0, col: 0 });
  });
});
