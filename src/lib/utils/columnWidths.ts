/**
 * Column width conversion.
 *
 * Excel does not store column widths in pixels. The `width` attribute in
 * `xl/worksheets/sheetN.xml` counts "characters of the maximum digit width of
 * the workbook's normal font, plus 5px of cell padding". SheetJS resolves that
 * for us when the workbook is read with `cellStyles: true`, exposing
 * `!cols[i]` entries carrying some combination of `wpx` (pixels), `wch`
 * (characters) and `width` (the raw attribute).
 *
 * This module turns those entries into the pixel widths the grid renders with.
 * Only columns the author actually sized in Excel produce a width — every other
 * column stays `undefined` so it falls back to the viewer's own default,
 * rather than being forced to Excel's narrower 64px default.
 */

/** Max digit width of Excel's default font (Calibri 11), in pixels. */
export const DEFAULT_MDW = 7;

/** Cell padding Excel folds into the stored character width, in pixels. */
const WIDTH_PADDING_PX = 5;

/**
 * Narrowest width a parsed column may render at. Well below the 30px floor the
 * interactive resize handle enforces, because spacer columns of a few pixels
 * are a real and deliberate layout device in Excel sheets.
 */
export const MIN_PARSED_COL_WIDTH = 8;

/** Widest a parsed column may render at — roughly Excel's own 255-character cap. */
export const MAX_PARSED_COL_WIDTH = 2000;

/**
 * The subset of SheetJS's `ColInfo` this module reads. Declared locally rather
 * than imported so the conversion stays testable without an `xlsx` dependency.
 */
export interface ColInfo {
  /** Width in pixels, when SheetJS could resolve one. */
  wpx?: number;
  /** Width in characters. */
  wch?: number;
  /** The raw OOXML `width` attribute (characters, padding included). */
  width?: number;
  /** Max digit width SheetJS calibrated for this workbook. */
  MDW?: number;
  /** True when the author set the width explicitly. */
  customWidth?: boolean | string | number;
  /** SheetJS lowercases the attribute when reading. */
  customwidth?: boolean | string | number;
}

function clampWidth(px: number): number {
  return Math.min(MAX_PARSED_COL_WIDTH, Math.max(MIN_PARSED_COL_WIDTH, Math.round(px)));
}

/**
 * Pixel width for one `!cols` entry, or `undefined` when the column carries no
 * author-set width and should keep the viewer default.
 *
 * The three sources are tried in decreasing order of reliability: `wpx` is
 * already resolved, `wch` needs the padding added back, and the raw `width`
 * attribute needs both the padding removed and the character unit scaled.
 */
export function colInfoToPx(info: ColInfo | null | undefined): number | undefined {
  if (!info) return undefined;

  const mdw = info.MDW && info.MDW > 0 ? info.MDW : DEFAULT_MDW;

  if (typeof info.wpx === 'number' && info.wpx > 0) {
    return clampWidth(info.wpx);
  }
  if (typeof info.wch === 'number' && info.wch > 0) {
    return clampWidth(info.wch * mdw + WIDTH_PADDING_PX);
  }
  if (typeof info.width === 'number' && info.width > 0) {
    // `width` already includes the padding, expressed in character units.
    return clampWidth(info.width * mdw);
  }
  return undefined;
}

/**
 * Build the dense `colWidths` array a SheetData carries, from a workbook's
 * `!cols`.
 *
 * `!cols` is sparse — SheetJS only fills the index ranges a `<col>` element
 * covers — so untouched columns are left as `undefined` holes on purpose. The
 * grid reads those as "use the default width", which keeps sheets that never
 * set a width rendering exactly as they did before.
 */
export function buildColWidths(cols: ReadonlyArray<ColInfo | null | undefined> | undefined): number[] {
  if (!cols || cols.length === 0) return [];
  const widths: number[] = new Array(cols.length);
  for (let i = 0; i < cols.length; i++) {
    const px = colInfoToPx(cols[i]);
    if (px !== undefined) widths[i] = px;
  }
  return widths;
}
