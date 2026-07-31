import { describe, it, expect } from 'vitest';
import { getRangeBox, getScrollToReveal, type Measurement } from '../gridGeometry';
import type { CellRange } from '../../types';

/** Build virtualizer-style measurements from a list of sizes. */
function measure(sizes: number[]): Measurement[] {
  const out: Measurement[] = [];
  let start = 0;
  for (const size of sizes) {
    out.push({ start, end: start + size });
    start += size;
  }
  return out;
}

function uniform(count: number, size: number): Measurement[] {
  return measure(new Array(count).fill(size));
}

const range = (
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): CellRange => ({ startRow, startCol, endRow, endCol });

describe('getRangeBox', () => {
  const rows = uniform(10, 26);
  const cols = uniform(10, 100);

  it('computes the box for a multi-cell range (A1:B2)', () => {
    expect(getRangeBox(range(0, 0, 1, 1), rows, cols)).toEqual({
      top: 0,
      left: 0,
      width: 200,
      height: 52,
    });
  });

  it('computes the box for a single cell', () => {
    expect(getRangeBox(range(2, 3, 2, 3), rows, cols)).toEqual({
      top: 52,
      left: 300,
      width: 100,
      height: 26,
    });
  });

  it('uses real measured sizes, not default COL_WIDTH/ROW_HEIGHT', () => {
    // This is the regression guard for the whole hardcoded-constants bug class:
    // resized columns/rows must shift and size the box correctly.
    const wideCols = measure([300, 100, 100]);
    const tallRows = measure([26, 60, 26]);

    // B2:C3 — starts after the 300px column and the 26px row
    expect(getRangeBox(range(1, 1, 2, 2), tallRows, wideCols)).toEqual({
      top: 26,
      left: 300,
      width: 200,
      height: 86,
    });
  });

  it('handles a range starting deep in a large grid', () => {
    const bigRows = uniform(100_000, 26);
    const box = getRangeBox(range(99_999, 0, 99_999, 0), bigRows, cols);
    expect(box).toEqual({
      top: 99_999 * 26,
      left: 0,
      width: 100,
      height: 26,
    });
  });

  it('clamps out-of-bounds ends to the last measurement', () => {
    // Guards phantom scrollbars: setHighlight('A1:B500') on a small sheet must
    // not produce a box taller than the grid.
    const box = getRangeBox(range(0, 0, 499, 1), rows, cols);
    expect(box).toEqual({
      top: 0,
      left: 0,
      width: 200,
      height: 10 * 26,
    });
  });

  it('clamps negative starts to zero', () => {
    expect(getRangeBox(range(-5, -5, 1, 1), rows, cols)).toEqual({
      top: 0,
      left: 0,
      width: 200,
      height: 52,
    });
  });

  it('normalizes an inverted range', () => {
    expect(getRangeBox(range(3, 2, 1, 0), rows, cols)).toEqual(
      getRangeBox(range(1, 0, 3, 2), rows, cols)
    );
  });

  it('returns null when measurements are unavailable', () => {
    expect(getRangeBox(range(0, 0, 1, 1), [], cols)).toBeNull();
    expect(getRangeBox(range(0, 0, 1, 1), rows, [])).toBeNull();
    expect(getRangeBox(range(0, 0, 1, 1), [], [])).toBeNull();
  });

  it('returns null for zero-size measurements', () => {
    const zeroRows = uniform(3, 0);
    expect(getRangeBox(range(0, 0, 1, 1), zeroRows, cols)).toBeNull();
  });
});

describe('getScrollToReveal', () => {
  // 400x200 viewport, currently scrolled to the origin
  const vp = { scrollTop: 0, scrollLeft: 0, clientWidth: 400, clientHeight: 200 };
  const box = (top: number, left: number, height: number, width: number) => ({
    top,
    left,
    width,
    height,
  });

  it('does not move when the box is already fully visible', () => {
    expect(getScrollToReveal(box(20, 20, 50, 50), vp)).toEqual({
      scrollTop: 0,
      scrollLeft: 0,
    });
  });

  it('does not move when the box exactly fills the viewport', () => {
    expect(getScrollToReveal(box(0, 0, 200, 400), vp)).toEqual({
      scrollTop: 0,
      scrollLeft: 0,
    });
  });

  it('scrolls down by the minimum needed to reveal the bottom edge', () => {
    // box spans 180..280, viewport shows 0..200 → need bottom (280) at the edge
    expect(getScrollToReveal(box(180, 0, 100, 50), vp).scrollTop).toBe(80);
  });

  it('scrolls right by the minimum needed to reveal the right edge', () => {
    // box spans 300..500, viewport shows 0..400 → 500 - 400
    expect(getScrollToReveal(box(0, 300, 20, 200), vp).scrollLeft).toBe(100);
  });

  it('scrolls up to the box start when the box is above the viewport', () => {
    const scrolled = { ...vp, scrollTop: 500 };
    expect(getScrollToReveal(box(120, 0, 50, 50), scrolled).scrollTop).toBe(120);
  });

  it('scrolls left to the box start when the box is left of the viewport', () => {
    const scrolled = { ...vp, scrollLeft: 800 };
    expect(getScrollToReveal(box(0, 250, 20, 50), scrolled).scrollLeft).toBe(250);
  });

  it('aligns to the start when the box is taller than the viewport', () => {
    // Cannot fit 600px into 200px — show the top rather than the bottom
    expect(getScrollToReveal(box(300, 0, 600, 50), vp).scrollTop).toBe(300);
  });

  it('aligns to the start when the box is wider than the viewport', () => {
    expect(getScrollToReveal(box(0, 700, 20, 900), vp).scrollLeft).toBe(700);
  });

  it('moves both axes independently in one call', () => {
    const scrolled = { ...vp, scrollTop: 400, scrollLeft: 0 };
    // vertically above the viewport, horizontally past the right edge
    expect(getScrollToReveal(box(100, 500, 40, 60), scrolled)).toEqual({
      scrollTop: 100,
      scrollLeft: 160,
    });
  });

  it('leaves the in-view axis alone while moving the other', () => {
    const scrolled = { ...vp, scrollTop: 50, scrollLeft: 90 };
    // vertically visible (50..250 shows 60..100); horizontally needs no move either
    expect(getScrollToReveal(box(60, 100, 40, 60), scrolled)).toEqual({
      scrollTop: 50,
      scrollLeft: 90,
    });
  });

  it('never returns a negative offset', () => {
    const r = getScrollToReveal(box(-50, -50, 10, 10), vp);
    expect(r.scrollTop).toBe(0);
    expect(r.scrollLeft).toBe(0);
  });

  it('falls back to the box start when the viewport is unmeasured', () => {
    // jsdom reports clientWidth/clientHeight as 0
    const unmeasured = { scrollTop: 0, scrollLeft: 0, clientWidth: 0, clientHeight: 0 };
    expect(getScrollToReveal(box(260, 130, 50, 50), unmeasured)).toEqual({
      scrollTop: 260,
      scrollLeft: 130,
    });
  });
});
