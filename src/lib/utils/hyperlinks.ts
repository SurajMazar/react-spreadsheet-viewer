/**
 * Workbook hyperlinks — which ones may become clickable, and reading them off
 * a SheetJS worksheet.
 *
 * A workbook is untrusted content: whoever made it chooses every link target.
 * A target like `javascript:…` on an anchor runs script in the host page's
 * origin when clicked (React 17 only warns about such an `href`; it still
 * writes it), so only a short allowlist of schemes is ever turned into a link.
 * Everything else stays plain text.
 */
import type { WorkSheet, utils as SheetJsUtils } from 'xlsx';
import type { CellHyperlink } from '../types';
import type { SheetRange } from './sheetBounds';

/**
 * Schemes a link from untrusted content may navigate to. Everything else
 * (`javascript:`, `vbscript:`, `data:`, `blob:`, `file:`, …) can run script
 * in the host origin or reach the local machine, so it is never emitted as an
 * `href`.
 */
const SAFE_LINK_PROTOCOLS: ReadonlySet<string> = new Set([
  'http:',
  'https:',
  'mailto:',
  // Phone numbers in contact sheets; the browser hands these to a dialer app
  // and they cannot run script.
  'tel:',
]);

/**
 * Returns an `href` that is safe to put on an anchor, or `null` when the
 * value must render as plain text.
 *
 * Only absolute `http:`, `https:`, `mailto:` and `tel:` URLs pass. The value
 * is run through the WHATWG URL parser — the same one the browser uses on the
 * attribute — so mixed case, surrounding whitespace and control characters,
 * and tabs or newlines inside the scheme are judged the way the browser would
 * judge them. The parser's normalized `href` is returned, so the anchor gets
 * exactly the URL that was checked.
 *
 * Relative values (`report.xlsx`, `//host/path`, `#Sheet2!A1`) are refused:
 * with no base they would resolve against the host page's origin, which is
 * never what the workbook's author pointed at.
 */
export function getSafeLinkHref(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return null;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  return SAFE_LINK_PROTOCOLS.has(url.protocol) ? url.href : null;
}

/** What SheetJS puts on a cell that carries a hyperlink. */
interface SheetJsCellLink {
  Target?: unknown;
  Tooltip?: unknown;
}

/**
 * Collect the safe hyperlinks of the cells inside `range`, keyed by
 * `"row,col"` like the other per-cell maps on `SheetData`.
 *
 * Links whose target fails {@link getSafeLinkHref} are left out, so their
 * cells render as plain text. Returns `undefined` when there are none, which
 * keeps `SheetData` free of an empty map for the common link-free sheet.
 *
 * Only cells SheetJS actually created are visited, never the full rectangle,
 * so a sheet that declares a huge range costs no more than its real cells.
 */
export function extractHyperlinks(
  worksheet: WorkSheet,
  range: SheetRange,
  decodeCell: typeof SheetJsUtils.decode_cell,
): Record<string, CellHyperlink> | undefined {
  let links: Record<string, CellHyperlink> | undefined;

  for (const address of Object.keys(worksheet)) {
    // `!ref`, `!merges`, `!cols`, … are sheet metadata, not cells.
    if (address.charCodeAt(0) === 33 /* ! */) continue;

    const link = (worksheet[address] as { l?: SheetJsCellLink } | undefined)?.l;
    if (!link) continue;

    const href = getSafeLinkHref(link.Target);
    if (!href) continue;

    const { r, c } = decodeCell(address);
    if (r < range.s.r || r > range.e.r || c < range.s.c || c > range.e.c) continue;

    const hyperlink: CellHyperlink = { href };
    if (typeof link.Tooltip === 'string' && link.Tooltip.trim() !== '') {
      hyperlink.tooltip = link.Tooltip;
    }
    if (!links) links = {};
    links[`${r},${c}`] = hyperlink;
  }

  return links;
}
