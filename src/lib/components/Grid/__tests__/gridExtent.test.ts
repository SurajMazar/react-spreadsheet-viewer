import { describe, it, expect } from 'vitest';
import { gridExtent } from '../gridExtent';

describe('gridExtent', () => {
  it('leaves at least 50 blank rows under a long sheet', () => {
    expect(gridExtent(45, 8, 30, 10).rows).toBe(100);
    expect(gridExtent(300, 8, 30, 10).rows).toBe(350);
  });

  it('draws at least 100 rows, and enough to fill the visible area', () => {
    expect(gridExtent(3, 3, 20, 10).rows).toBe(100);
    expect(gridExtent(3, 3, 200, 10).rows).toBe(210);
  });

  it('leaves blank columns beside the data', () => {
    expect(gridExtent(10, 40, 30, 12).cols).toBe(45);
    expect(gridExtent(10, 3, 30, 12).cols).toBe(17);
  });
});
