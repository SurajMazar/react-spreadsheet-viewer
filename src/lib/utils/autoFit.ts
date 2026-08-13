/**
 * Auto-fit column width.
 *
 * Double-clicking the edge of a column header sizes that column to its widest
 * cell, the same gesture Excel and Google Sheets use. Widths are computed in
 * base (unzoomed) pixels, because that is what the store holds — the grid
 * applies zoom on top when it renders.
 *
 * Text is measured with a canvas rather than by laying cells out in the DOM:
 * the grid is virtualized, so most of a column's cells do not exist as
 * elements and could not be measured any other way.
 */

import type { CellValue, CellStyle, SheetData } from '../types';

/** Narrowest an auto-fitted column may become, matching the resize handle's floor. */
export const AUTO_FIT_MIN_WIDTH = 30;

/**
 * Widest an auto-fitted column may become. A single cell holding a paragraph
 * of text would otherwise push every other column off-screen.
 */
export const AUTO_FIT_MAX_WIDTH = 500;

/** Horizontal cell padding (6px each side) plus a little breathing room. */
export const AUTO_FIT_PADDING = 14;

/**
 * Ceiling on how many rows one auto-fit measures. Sheets here run to hundreds
 * of thousands of rows and the gesture has to feel instant; beyond this the
 * width is fitted to the leading rows rather than freezing the UI.
 */
export const AUTO_FIT_MAX_SCAN_ROWS = 20000;

/** Default grid typography, mirroring `--sv-font-size-base` and `--sv-font-family`. */
export const DEFAULT_AUTO_FIT_FONT: AutoFitFont = {
  family:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  sizePx: 13,
};

/** The font a column's unstyled cells are drawn in. */
export interface AutoFitFont {
  family: string;
  sizePx: number;
}

/** Measures a string's width, in px, for a CSS `font` shorthand. */
export type MeasureText = (text: string, font: string) => number;

export interface AutoFitOptions {
  font?: AutoFitFont;
  minWidth?: number;
  maxWidth?: number;
  padding?: number;
  maxScanRows?: number;
}

/** Points → pixels, the unit `CellStyle.fontSize` is stored in. */
function ptToPx(pt: number): number {
  return (pt * 96) / 72;
}

/** CSS `font` shorthand for one cell, given the grid's base font. */
export function cellFont(style: CellStyle | undefined, base: AutoFitFont): string {
  const sizePx = style?.fontSize ? ptToPx(style.fontSize) : base.sizePx;
  const weight = style?.bold ? '700' : '400';
  const italic = style?.italic ? 'italic ' : '';
  return `${italic}${weight} ${sizePx}px ${base.family}`;
}

/**
 * A `MeasureText` backed by a shared offscreen canvas, or `null` where no
 * canvas is available (SSR, or a jsdom build without one).
 *
 * The canvas is created once and kept: allocating one per measurement is by
 * far the most expensive part of fitting a long column.
 */
let sharedContext: CanvasRenderingContext2D | null | undefined;

export function createCanvasTextMeasurer(): MeasureText | null {
  if (sharedContext === undefined) {
    try {
      sharedContext = document.createElement('canvas').getContext('2d');
    } catch {
      sharedContext = null;
    }
  }
  const ctx = sharedContext;
  if (!ctx) return null;

  return (text: string, font: string) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };
}

/**
 * Read the grid's own typography off a mounted element, so auto-fit measures
 * with the font the consumer's theme actually renders.
 *
 * The size comes from the `--sv-font-size-base` custom property rather than
 * the element's computed `font-size`, because cells scale theirs by the zoom
 * factor and auto-fit works in unzoomed pixels.
 */
export function resolveAutoFitFont(el: Element | null | undefined): AutoFitFont {
  if (!el || typeof getComputedStyle !== 'function') return DEFAULT_AUTO_FIT_FONT;
  try {
    const cs = getComputedStyle(el);
    const sizePx = parseFloat(cs.getPropertyValue('--sv-font-size-base'));
    return {
      family: cs.fontFamily || DEFAULT_AUTO_FIT_FONT.family,
      sizePx: Number.isFinite(sizePx) && sizePx > 0 ? sizePx : DEFAULT_AUTO_FIT_FONT.sizePx,
    };
  } catch {
    return DEFAULT_AUTO_FIT_FONT;
  }
}

function toText(value: CellValue): string {
  return value == null ? '' : String(value);
}

/**
 * Columns spanned by a multi-column merge, whose content belongs to the merge
 * rather than to any one column and so must not drive that column's width.
 */
function isCoveredByWideMerge(sheet: SheetData, row: number, col: number): boolean {
  if (!sheet.merges) return false;
  for (const m of sheet.merges) {
    if (m.e.c === m.s.c) continue; // single-column merge sits inside one column
    if (row >= m.s.r && row <= m.e.r && col >= m.s.c && col <= m.e.c) return true;
  }
  return false;
}

/**
 * Width in base pixels that fits the widest content in `colIndex`, clamped to
 * the min/max limits. Returns `null` when the column holds nothing to measure,
 * so the caller can leave the column as it is instead of collapsing it.
 */
export function computeAutoFitWidth(
  colIndex: number,
  sheet: SheetData,
  measure: MeasureText,
  options: AutoFitOptions = {}
): number | null {
  const {
    font = DEFAULT_AUTO_FIT_FONT,
    minWidth = AUTO_FIT_MIN_WIDTH,
    maxWidth = AUTO_FIT_MAX_WIDTH,
    padding = AUTO_FIT_PADDING,
    maxScanRows = AUTO_FIT_MAX_SCAN_ROWS,
  } = options;

  if (colIndex < 0) return null;

  const rowCount = Math.min(sheet.data.length, sheet.rows || sheet.data.length, maxScanRows);
  let widest = 0;
  let sawContent = false;

  for (let row = 0; row < rowCount; row++) {
    const text = toText(sheet.data[row]?.[colIndex]);
    if (text === '') continue;
    if (isCoveredByWideMerge(sheet, row, colIndex)) continue;

    sawContent = true;
    const font_ = cellFont(sheet.styles?.[`${row},${colIndex}`], font);

    // Multi-line cells are as wide as their longest line, not their whole text.
    for (const line of text.split('\n')) {
      const w = measure(line, font_);
      if (w > widest) widest = w;
    }
  }

  if (!sawContent) return null;
  return Math.min(maxWidth, Math.max(minWidth, Math.ceil(widest + padding)));
}
