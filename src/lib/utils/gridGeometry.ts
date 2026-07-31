/**
 * Convert a CellRange into a pixel box in grid content coordinates.
 *
 * The measurements passed in come from @tanstack/react-virtual's public
 * `measurementsCache` (one entry per row / column, always fully populated).
 * Reading offsets from the virtualizer — rather than recomputing them from
 * COL_WIDTH / ROW_HEIGHT — keeps overlays pixel-identical to the cells they
 * cover even when columns or rows have been resized.
 */

import type { CellRange } from '../types';

export interface RangeBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Minimal shape of @tanstack/react-virtual's VirtualItem that we need. */
export interface Measurement {
  start: number;
  end: number;
}

function clampIndex(value: number, max: number): number {
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
}

/**
 * Pixel box (content coordinates) covering a cell range, using real measured
 * row/column offsets. Indices are normalized and clamped into the measured
 * grid; returns null when geometry is not available or the box is empty.
 *
 * Clamping is required, not defensive: `parseRangeExpression` only clamps
 * whole-column/whole-row forms, so a range like "A1:B500" on a 3-row sheet
 * arrives with endRow = 499. An unclamped box would extend past the sizer and
 * inflate the scrollable area, producing phantom scrollbars.
 */
export function getRangeBox(
  range: CellRange,
  rows: ReadonlyArray<Measurement>,
  cols: ReadonlyArray<Measurement>
): RangeBox | null {
  if (rows.length === 0 || cols.length === 0) return null;

  const maxRow = rows.length - 1;
  const maxCol = cols.length - 1;
  const startRow = clampIndex(Math.min(range.startRow, range.endRow), maxRow);
  const endRow = clampIndex(Math.max(range.startRow, range.endRow), maxRow);
  const startCol = clampIndex(Math.min(range.startCol, range.endCol), maxCol);
  const endCol = clampIndex(Math.max(range.startCol, range.endCol), maxCol);

  const first = rows[startRow];
  const last = rows[endRow];
  const left = cols[startCol];
  const right = cols[endCol];
  if (!first || !last || !left || !right) return null;

  const box: RangeBox = {
    top: first.start,
    left: left.start,
    width: right.end - left.start,
    height: last.end - first.start,
  };
  if (box.width <= 0 || box.height <= 0) return null;
  return box;
}

/** Scroll state of the grid's scroll container. */
export interface ScrollViewport {
  scrollTop: number;
  scrollLeft: number;
  clientWidth: number;
  clientHeight: number;
}

export interface ScrollOffsets {
  scrollTop: number;
  scrollLeft: number;
}

/** Minimal offset along one axis that brings [start, end) fully into view. */
function revealAxis(
  start: number,
  size: number,
  offset: number,
  viewport: number
): number {
  // Viewport not measured yet (jsdom, or before first layout): jump to the start
  // rather than computing against a zero-width window.
  if (viewport <= 0) return Math.max(0, start);
  // Larger than the viewport: it cannot fit, so show the start edge.
  if (size >= viewport) return Math.max(0, start);
  if (start < offset) return Math.max(0, start);
  const end = start + size;
  if (end > offset + viewport) return Math.max(0, end - viewport);
  return offset;
}

/**
 * Smallest scroll offsets that bring `box` completely into view, scrolling only
 * along the axes that need it and by the least amount required. A box already
 * fully visible returns the current offsets unchanged.
 */
export function getScrollToReveal(box: RangeBox, viewport: ScrollViewport): ScrollOffsets {
  return {
    scrollTop: revealAxis(box.top, box.height, viewport.scrollTop, viewport.clientHeight),
    scrollLeft: revealAxis(box.left, box.width, viewport.scrollLeft, viewport.clientWidth),
  };
}
