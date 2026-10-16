import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { extractHyperlinks, getSafeLinkHref } from '../hyperlinks';
import { worksheetToSheetData } from '../worksheetData';
import { DEFAULT_SHEET_LIMITS, resolveSheetLimits } from '../sheetBounds';

/** The read options the parser uses. */
const READ_OPTS = { type: 'array', cellDates: true, cellNF: true, sheetStubs: true, cellStyles: true } as const;

/** Write a one-sheet .xlsx and read it back the way the parser does. */
function roundTrip(ws: XLSX.WorkSheet): XLSX.WorkSheet {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Links');
  const written = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const read = XLSX.read(new Uint8Array(written), READ_OPTS);
  return read.Sheets.Links;
}

/** A sheet whose column A holds `targets` as hyperlinks, one per row. */
function sheetWithLinks(targets: string[], tooltip?: string): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(targets.map((t) => [t]));
  targets.forEach((target, r) => {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    cell.l = tooltip ? { Target: target, Tooltip: tooltip } : { Target: target };
  });
  return roundTrip(ws);
}

describe('getSafeLinkHref', () => {
  it('keeps the schemes a link may use', () => {
    expect(getSafeLinkHref('https://docsumo.com/pricing')).toBe('https://docsumo.com/pricing');
    expect(getSafeLinkHref('http://example.com/a?b=c#d')).toBe('http://example.com/a?b=c#d');
    expect(getSafeLinkHref('mailto:ops@example.com')).toBe('mailto:ops@example.com');
    expect(getSafeLinkHref('tel:+1-555-0100')).toBe('tel:+1-555-0100');
    expect(getSafeLinkHref('TEL:+15550100')).toBe('tel:+15550100');
  });

  it('returns the normalized URL it checked', () => {
    expect(getSafeLinkHref('  HTTPS://Example.COM  ')).toBe('https://example.com/');
  });

  it('refuses script, data and local schemes', () => {
    [
      'javascript:alert(1)',
      'vbscript:msgbox(1)',
      'data:text/html,<script>alert(1)</script>',
      'blob:https://example.com/0f4e2a',
      'file:///etc/passwd',
      'ms-excel:ofe|u|https://example.com/x.xlsx',
    ].forEach((href) => expect(getSafeLinkHref(href)).toBeNull());
  });

  it('refuses a scheme hidden by case, whitespace or control characters', () => {
    [
      'JaVaScRiPt:alert(1)',
      '  javascript:alert(1)',
      '\u0000\u001fjavascript:alert(1)',
      '\tjavascript:alert(1)\n',
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      'java\rscript:alert(1)',
    ].forEach((href) => expect(getSafeLinkHref(href)).toBeNull());
  });

  // An attribute value is not HTML-decoded again, so these are not schemes at
  // all to the browser; they are relative paths, which are refused too.
  it('refuses entity- and percent-encoded schemes', () => {
    [
      'javascript&colon;alert(1)',
      'javascript&#58;alert(1)',
      '&#106;avascript:alert(1)',
      '%6Aavascript:alert(1)',
      'javascript%3Aalert(1)',
    ].forEach((href) => expect(getSafeLinkHref(href)).toBeNull());
  });

  it('refuses relative, protocol-relative and in-workbook links', () => {
    ['//evil.example.com/path', '/documents/123', 'report.xlsx', '../other.xlsx', '#Sheet2!A1'].forEach(
      (href) => expect(getSafeLinkHref(href)).toBeNull(),
    );
  });

  it('refuses empty, malformed and non-string values', () => {
    ['', '   ', 'https://', 'http://exa mple.com', null, undefined, 42, {}].forEach((href) =>
      expect(getSafeLinkHref(href)).toBeNull(),
    );
  });
});

describe('extractHyperlinks', () => {
  const fullRange = (ws: XLSX.WorkSheet) => XLSX.utils.decode_range(ws['!ref'] as string);

  it('keeps safe links from a real .xlsx, keyed by "row,col"', () => {
    const ws = sheetWithLinks(['https://docsumo.com', 'mailto:qa@example.test', 'tel:+15550100']);
    expect(extractHyperlinks(ws, fullRange(ws), XLSX.utils.decode_cell)).toEqual({
      '0,0': { href: 'https://docsumo.com/' },
      '1,0': { href: 'mailto:qa@example.test' },
      '2,0': { href: 'tel:+15550100' },
    });
  });

  it('drops unsafe targets so those cells stay plain text', () => {
    const ws = sheetWithLinks([
      'javascript:alert(document.domain)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,<h1>x</h1>',
      'file:///etc/passwd',
      'https://ok.example.com/',
    ]);
    expect(extractHyperlinks(ws, fullRange(ws), XLSX.utils.decode_cell)).toEqual({
      '4,0': { href: 'https://ok.example.com/' },
    });
  });

  it('carries the screen tip when the workbook has one', () => {
    const ws = sheetWithLinks(['https://docsumo.com'], 'Open Docsumo');
    expect(extractHyperlinks(ws, fullRange(ws), XLSX.utils.decode_cell)).toEqual({
      '0,0': { href: 'https://docsumo.com/', tooltip: 'Open Docsumo' },
    });
  });

  it('returns undefined when the sheet has no safe links', () => {
    const plain = roundTrip(XLSX.utils.aoa_to_sheet([['a', 'b'], [1, 2]]));
    expect(extractHyperlinks(plain, fullRange(plain), XLSX.utils.decode_cell)).toBeUndefined();

    const unsafeOnly = sheetWithLinks(['javascript:alert(1)']);
    expect(extractHyperlinks(unsafeOnly, fullRange(unsafeOnly), XLSX.utils.decode_cell)).toBeUndefined();
  });

  it('ignores links outside the range being read', () => {
    const ws = sheetWithLinks(['https://a.example.com', 'https://b.example.com', 'https://c.example.com']);
    const firstTwoRows = { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } };
    expect(Object.keys(extractHyperlinks(ws, firstTwoRows, XLSX.utils.decode_cell) ?? {})).toEqual(['0,0', '1,0']);
  });
});

describe('worksheetToSheetData — hyperlinks', () => {
  const limits = resolveSheetLimits(DEFAULT_SHEET_LIMITS);

  it('puts the safe links on SheetData at their absolute cell positions', () => {
    // Data starts at C3, so the sheet is read with row/column offsets.
    const ws: XLSX.WorkSheet = {};
    XLSX.utils.sheet_add_aoa(ws, [['https://docsumo.com'], ['javascript:alert(1)']], { origin: 'C3' });
    ws.C3.l = { Target: 'https://docsumo.com' };
    ws.C4.l = { Target: 'javascript:alert(1)' };
    const sheet = worksheetToSheetData(roundTrip(ws), XLSX.utils, limits);

    expect(sheet.data[2][2]).toBe('https://docsumo.com');
    expect(sheet.hyperlinks).toEqual({ '2,2': { href: 'https://docsumo.com/' } });
  });

  it('leaves hyperlinks unset on a sheet without links', () => {
    const sheet = worksheetToSheetData(roundTrip(XLSX.utils.aoa_to_sheet([['a']])), XLSX.utils, limits);
    expect(sheet).not.toHaveProperty('hyperlinks');
  });
});
