/**
 * Zoom maths.
 *
 * Zoom is a plain scale factor (1 = 100%). The grid applies it by scaling the
 * geometry it already measures — column widths, row heights, header bands and
 * font sizes — rather than by CSS-transforming the scroll container. Keeping
 * every measurement in real pixels means hit testing, scrolling, the
 * virtualizer's measurement cache and every overlay derived from it stay
 * correct at any zoom level, with no coordinate translation anywhere.
 */

/** Zoom levels offered by the zoom control, mirroring Google Sheets. */
export const ZOOM_LEVELS: readonly number[] = Object.freeze([0.5, 0.75, 0.9, 1, 1.25, 1.5, 2]);

/** Hard lower bound. Below this, rows collapse to unreadable slivers. */
export const MIN_ZOOM = 0.25;

/** Hard upper bound. */
export const MAX_ZOOM = 4;

/** Neutral zoom. */
export const DEFAULT_ZOOM = 1;

/** Direction of a single zoom step. */
export type ZoomDirection = 'in' | 'out';

/**
 * Constrain a zoom factor to `[min, max]`, falling back to `DEFAULT_ZOOM` for
 * values that are not usable numbers (NaN, Infinity, zero or negative).
 */
export function clampZoom(zoom: number, min: number = MIN_ZOOM, max: number = MAX_ZOOM): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return clampZoom(DEFAULT_ZOOM, min, max);
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.min(hi, Math.max(lo, zoom));
}

/**
 * The zoom level one step from `current` in `direction`.
 *
 * Steps to the nearest level strictly past the current one, so a zoom set to an
 * off-list value (via the `zoom` prop or `setZoom`) still moves sensibly.
 *
 * The level list is the whole ladder: at the highest or lowest level this is a
 * no-op rather than a jump on to `maxZoom`/`minZoom`. Those bounds are the
 * limit for `setZoom`, not extra rungs — stepping past the last level would
 * land the viewer on a zoom the picker never offers, which is exactly what a
 * user stepping through the levels does not expect.
 */
export function stepZoom(
  current: number,
  direction: ZoomDirection,
  levels: readonly number[] = ZOOM_LEVELS,
  min: number = MIN_ZOOM,
  max: number = MAX_ZOOM
): number {
  const bounded = clampZoom(current, min, max);
  const usable = levels
    .filter((level) => Number.isFinite(level) && level > 0)
    .map((level) => clampZoom(level, min, max))
    .sort((a, b) => a - b);

  if (direction === 'in') {
    const next = usable.find((level) => level > bounded);
    return next ?? bounded;
  }
  const prev = [...usable].reverse().find((level) => level < bounded);
  return prev ?? bounded;
}

/** Format a zoom factor the way the control labels it, e.g. `0.75` → `"75%"`. */
export function formatZoomLabel(zoom: number): string {
  return `${Math.round(clampZoom(zoom, MIN_ZOOM, MAX_ZOOM) * 100)}%`;
}

/**
 * Scale a base pixel measurement to the current zoom, rounded to whole pixels.
 *
 * Rounding here rather than in CSS keeps the virtualizer's measurements, the
 * cells it positions and every overlay reading its cache on the same integer
 * grid, so no hairline seams open up between them.
 */
export function scaleToZoom(px: number, zoom: number): number {
  return Math.max(1, Math.round(px * zoom));
}
