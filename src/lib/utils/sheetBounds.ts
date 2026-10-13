/**
 * Bounding the part of a worksheet the parser materialises.
 *
 * A sheet's declared range (`!ref`) comes straight from the file — the
 * `<dimension ref>` element of an `.xlsx` — and SheetJS trusts it. The parser
 * asks `sheet_to_json` for `defval` + `blankrows`, which fills in every cell of
 * that range, so a 1 KB file declaring `A1:XFD1048576` asks for ~17 billion
 * cells and takes the tab down before the grid can render anything.
 *
 * Everything here works from what the sheet object actually holds instead: the
 * cell keys SheetJS created while reading the file. Their count is bounded by
 * the file's own content, so scanning them is safe, and the range they span is
 * the most a faithful render ever needs. That range is then held to a cell
 * budget; a sheet that is still over it is refused rather than parsed.
 *
 * Kept free of any `xlsx` import so it stays cheap to load and easy to test —
 * the caller passes SheetJS's own `decode_cell` in.
 */
import type { SheetViewerLimits } from '../types';

/** A 0-based cell address, the shape SheetJS uses. */
export interface CellAddress {
  r: number;
  c: number;
}

/** A 0-based inclusive range, the shape SheetJS uses for `!ref` and `!merges`. */
export interface SheetRange {
  s: CellAddress;
  e: CellAddress;
}

/** Fully resolved parse limits — every field set. */
export type ResolvedSheetLimits = Required<SheetViewerLimits>;

/**
 * Default parse limits.
 *
 * Rows and columns default to Excel's own maxima, so they never bite on a
 * well-formed file; the cell budget is what stops an over-declared range.
 */
export const DEFAULT_SHEET_LIMITS: Readonly<ResolvedSheetLimits> = Object.freeze({
  maxRows: 1_048_576,
  maxCols: 16_384,
  maxCells: 2_000_000,
});

/**
 * Fill in any limit the consumer left out, or gave as something that is not a
 * usable positive number (NaN, zero, negative), from the defaults. `Infinity`
 * is accepted and switches that one limit off.
 */
export function resolveSheetLimits(
  limits?: SheetViewerLimits | null,
): ResolvedSheetLimits {
  const pick = (value: number | undefined, fallback: number): number =>
    typeof value === 'number' && value > 0 ? value : fallback;
  return {
    maxRows: pick(limits?.maxRows, DEFAULT_SHEET_LIMITS.maxRows),
    maxCols: pick(limits?.maxCols, DEFAULT_SHEET_LIMITS.maxCols),
    maxCells: pick(limits?.maxCells, DEFAULT_SHEET_LIMITS.maxCells),
  };
}

/**
 * Cells the parser builds for `range`: one per column from A to the last
 * column (leading empty columns are padded in so indices line up with the
 * sheet), for every row from the first to the last. Rows above the range are
 * empty arrays and cost nothing worth counting.
 */
export function rangeCellCount(range: SheetRange): number {
  return (range.e.r - range.s.r + 1) * (range.e.c + 1);
}

/**
 * Whether a grid of `rows` × `cols` is over `limits`. Used where there is no
 * declared range to bound — CSV, whose rows can be ragged — with `cols` the
 * widest row.
 */
export function exceedsSheetLimits(rows: number, cols: number, limits: ResolvedSheetLimits): boolean {
  return rows > limits.maxRows || cols > limits.maxCols || rows * cols > limits.maxCells;
}

/** Area of a range, in cells. */
function area(range: SheetRange): number {
  return (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
}

function isAddress(addr: CellAddress): boolean {
  return Number.isInteger(addr.r) && Number.isInteger(addr.c) && addr.r >= 0 && addr.c >= 0;
}

function contains(range: SheetRange, r: number, c: number): boolean {
  return r >= range.s.r && r <= range.e.r && c >= range.s.c && c <= range.e.c;
}

/**
 * The part of the declared range the sheet really uses.
 *
 * Keeps the declared start, so data that begins at, say, C4 is still placed at
 * C4. The end shrinks to the last row and the last column holding a real cell,
 * and never grows past the declared end. A merge whose top-left cell is a real
 * cell counts out to its far corner as well, so a merged title hanging past
 * the last value keeps its full width.
 *
 * Only the keys the sheet object holds are visited (`!`-prefixed metadata keys
 * are skipped), never the range itself. Returns `null` when no real cell falls
 * inside the declared range.
 */
export function findUsedRange(
  sheet: Readonly<Record<string, unknown>>,
  declared: SheetRange,
  merges: ReadonlyArray<SheetRange> | undefined,
  decodeCell: (address: string) => CellAddress,
): SheetRange | null {
  // Far corner of each merge, keyed by its top-left cell
  let anchors: Map<string, CellAddress> | null = null;
  if (merges && merges.length > 0) {
    anchors = new Map();
    for (const m of merges) {
      if (!isAddress(m.s) || !isAddress(m.e)) continue;
      const key = `${m.s.r},${m.s.c}`;
      const prev = anchors.get(key);
      anchors.set(key, {
        r: Math.max(prev?.r ?? -1, m.e.r),
        c: Math.max(prev?.c ?? -1, m.e.c),
      });
    }
  }

  let endRow = -1;
  let endCol = -1;

  for (const key in sheet) {
    if (key.charCodeAt(0) === 33 /* '!' */) continue;
    const addr = decodeCell(key);
    if (!isAddress(addr) || !contains(declared, addr.r, addr.c)) continue;

    let r = addr.r;
    let c = addr.c;
    if (anchors) {
      const far = anchors.get(`${r},${c}`);
      if (far) {
        r = Math.max(r, far.r);
        c = Math.max(c, far.c);
      }
    }
    if (r > endRow) endRow = r;
    if (c > endCol) endCol = c;
  }

  if (endRow < 0) return null;

  return {
    s: { r: declared.s.r, c: declared.s.c },
    e: { r: Math.min(endRow, declared.e.r), c: Math.min(endCol, declared.e.c) },
  };
}

/**
 * Clip merges to `range`: a merge whose top-left cell lies outside it is
 * dropped, and one that runs past its end is cut back to it. Also returns the
 * merged area left after clipping, which the grid expands cell by cell.
 */
export function clipMerges(
  merges: ReadonlyArray<SheetRange> | undefined,
  range: SheetRange,
): { merges: SheetRange[]; mergedCells: number } {
  const out: SheetRange[] = [];
  let mergedCells = 0;
  if (!merges) return { merges: out, mergedCells };

  for (const m of merges) {
    if (!isAddress(m.s) || !isAddress(m.e)) continue;
    if (!contains(range, m.s.r, m.s.c)) continue;
    const clipped: SheetRange = {
      s: { r: m.s.r, c: m.s.c },
      e: { r: Math.min(m.e.r, range.e.r), c: Math.min(m.e.c, range.e.c) },
    };
    if (clipped.e.r < clipped.s.r || clipped.e.c < clipped.s.c) continue;
    out.push(clipped);
    mergedCells += area(clipped);
  }

  return { merges: out, mergedCells };
}

/** Why a sheet was refused. */
export type SheetTooLargeReason = 'rows' | 'cols' | 'cells' | 'merges';

/** What the parser should do with one worksheet. */
export type SheetBoundsPlan =
  /** No real cell inside the declared range. */
  | { kind: 'empty' }
  /** Over budget: do not parse. `range` is the used range that was measured. */
  | { kind: 'tooLarge'; reason: SheetTooLargeReason; range: SheetRange }
  /** Parse `range` only, with `merges` already clipped to it. */
  | { kind: 'ok'; range: SheetRange; merges: SheetRange[] };

/**
 * Decide how much of a worksheet to parse: find the used range, clip the
 * merges to it, and hold both to `limits`.
 *
 * Row and column limits apply to the sheet's extent as the grid sees it (last
 * row + 1, last column + 1). The cell limit applies to the cells the parser
 * builds (see {@link rangeCellCount}) and, separately, to the total merged
 * area after clipping — the grid expands every merged cell into a lookup, and
 * merges may overlap, so their sum can exceed the range itself.
 */
export function planSheetBounds(
  sheet: Readonly<Record<string, unknown>>,
  declared: SheetRange,
  merges: ReadonlyArray<SheetRange> | undefined,
  limits: ResolvedSheetLimits,
  decodeCell: (address: string) => CellAddress,
): SheetBoundsPlan {
  if (!isAddress(declared.s) || !isAddress(declared.e)) return { kind: 'empty' };

  const range = findUsedRange(sheet, declared, merges, decodeCell);
  if (!range) return { kind: 'empty' };

  if (range.e.r + 1 > limits.maxRows) return { kind: 'tooLarge', reason: 'rows', range };
  if (range.e.c + 1 > limits.maxCols) return { kind: 'tooLarge', reason: 'cols', range };
  if (rangeCellCount(range) > limits.maxCells) return { kind: 'tooLarge', reason: 'cells', range };

  const clipped = clipMerges(merges, range);
  if (clipped.mergedCells > limits.maxCells) return { kind: 'tooLarge', reason: 'merges', range };

  return { kind: 'ok', range, merges: clipped.merges };
}
