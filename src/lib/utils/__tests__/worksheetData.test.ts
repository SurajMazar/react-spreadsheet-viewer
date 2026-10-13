import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { worksheetToSheetData } from '../worksheetData';
import { buildColWidths, type ColInfo } from '../columnWidths';
import { DEFAULT_SHEET_LIMITS, resolveSheetLimits } from '../sheetBounds';
import type { CellValue, SheetData } from '../../types';

/** The read options the parser uses. */
const READ_OPTS = { type: 'array', cellDates: true, cellNF: true, sheetStubs: true, cellStyles: true } as const;

/**
 * Write `sheets` to a real .xlsx, optionally rewrite each sheet's XML (to
 * plant a declared range or merges no writer would produce), and read it back
 * the way the parser does.
 */
function roundTrip(
  sheets: Record<string, XLSX.WorkSheet>,
  patch: Record<number, (xml: string) => string> = {},
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const [name, ws] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, ws, name);
  const written = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const zip = unzipSync(new Uint8Array(written));
  for (const [index, fn] of Object.entries(patch)) {
    const path = `xl/worksheets/sheet${index}.xml`;
    // Copied so the bytes belong to this realm: jsdom's TextEncoder hands back
    // a Node Uint8Array that SheetJS's instanceof checks do not recognise.
    zip[path] = new Uint8Array(strToU8(fn(strFromU8(zip[path]))));
  }
  return XLSX.read(zipSync(zip), READ_OPTS);
}

const setDimension = (ref: string) => (xml: string) =>
  xml.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="${ref}"/>`);

const addMerges = (...refs: string[]) => (xml: string) =>
  xml.replace(
    '</sheetData>',
    `</sheetData><mergeCells count="${refs.length}">${refs.map((r) => `<mergeCell ref="${r}"/>`).join('')}</mergeCells>`,
  );

/** The pre-fix conversion, verbatim, to prove normal sheets are unchanged. */
function legacySheetData(worksheet: XLSX.WorkSheet): SheetData {
  const ref = worksheet['!ref'];
  if (!ref) return { data: [], cols: 0, rows: 0, merges: [], colWidths: [] };
  const range = XLSX.utils.decode_range(ref);
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: true, raw: false }) as CellValue[][];
  let data: CellValue[][];
  if (range.s.r === 0 && range.s.c === 0) {
    data = rawData;
  } else {
    data = [];
    for (let r = 0; r < range.s.r; r++) data.push([]);
    for (const row of rawData) {
      if (range.s.c > 0) {
        const padded: CellValue[] = new Array(range.s.c).fill('');
        padded.push(...row);
        data.push(padded);
      } else {
        data.push(row);
      }
    }
  }
  const rows = Math.max(range.e.r + 1, data.length);
  const cols = Math.max(range.e.c + 1, data.reduce((m, row) => Math.max(m, row.length), 0));
  const merges = (worksheet['!merges'] || []).map((m) => ({ s: { ...m.s }, e: { ...m.e } }));
  return { data, cols, rows, merges, colWidths: buildColWidths(worksheet['!cols'] as ColInfo[] | undefined) };
}

const convert = (ws: XLSX.WorkSheet, limits = DEFAULT_SHEET_LIMITS) =>
  worksheetToSheetData(ws, XLSX.utils, limits);

describe('worksheetToSheetData — normal sheets are unchanged', () => {
  it('matches the previous output for a plain sheet', () => {
    const wb = roundTrip({ S: XLSX.utils.aoa_to_sheet([['Name', 'Age'], ['Alice', 30], ['Bob', 25]]) });
    const ws = wb.Sheets.S;
    expect(convert(ws)).toEqual(legacySheetData(ws));
    expect(convert(ws).data).toEqual([['Name', 'Age'], ['Alice', '30'], ['Bob', '25']]);
  });

  it('matches the previous output for data starting at C4', () => {
    const ws0 = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.sheet_add_aoa(ws0, [['h1', 'h2'], [1, 2]], { origin: 'C4' });
    ws0['!ref'] = 'C4:D5';
    const ws = roundTrip({ S: ws0 }).Sheets.S;
    expect(ws['!ref']).toBe('C4:D5');
    const out = convert(ws);
    expect(out).toEqual(legacySheetData(ws));
    expect(out.data[3]).toEqual(['', '', 'h1', 'h2']);
    expect(out.rows).toBe(5);
    expect(out.cols).toBe(4);
  });

  it('matches the previous output with merges and column widths', () => {
    const ws0 = XLSX.utils.aoa_to_sheet([['Title', '', ''], ['a', 'b', 'c'], ['d', 'e', 'f']]);
    ws0['!merges'] = [XLSX.utils.decode_range('A1:C1')];
    ws0['!cols'] = [{ wch: 20 }, { wpx: 150 }];
    const ws = roundTrip({ S: ws0 }).Sheets.S;
    const out = convert(ws);
    expect(out).toEqual(legacySheetData(ws));
    expect(out.merges).toEqual([XLSX.utils.decode_range('A1:C1')]);
    expect(out.colWidths[1]).toBe(150);
  });

  it('keeps a merged title that runs past the last value', () => {
    // Writers other than Excel often emit no cells for the covered part
    const ws = roundTrip({ S: XLSX.utils.aoa_to_sheet([['Title'], ['a']]) }, {
      1: (xml) => addMerges('A1:E1')(setDimension('A1:E2')(xml)),
    }).Sheets.S;
    const out = convert(ws);
    expect(out).toEqual(legacySheetData(ws));
    expect(out.cols).toBe(5);
  });
});

describe('worksheetToSheetData — declared range is not trusted', () => {
  it('clamps one real cell in a declared A1:XFD1048576', () => {
    const ws = roundTrip({ S: XLSX.utils.aoa_to_sheet([['x']]) }, { 1: setDimension('A1:XFD1048576') }).Sheets.S;
    expect(ws['!ref']).toBe('A1:XFD1048576');
    const out = convert(ws);
    expect(out).toEqual({ data: [['x']], rows: 1, cols: 1, merges: [], colWidths: [] });
    // The worksheet itself is not rewritten
    expect(ws['!ref']).toBe('A1:XFD1048576');
  });

  it('drops trailing empty rows and columns of an over-declared range', () => {
    const ws = roundTrip({ S: XLSX.utils.aoa_to_sheet([['a', 'b'], ['c', 'd']]) }, { 1: setDimension('A1:Z500') }).Sheets.S;
    const out = convert(ws);
    expect(out.rows).toBe(2);
    expect(out.cols).toBe(2);
    expect(out.data).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('refuses two real cells at opposite corners of the grid', () => {
    const ws0 = XLSX.utils.aoa_to_sheet([['top']]);
    const ws = roundTrip({ S: ws0 }, {
      1: (xml) =>
        setDimension('A1:XFD1048576')(xml).replace(
          '</row></sheetData>',
          '</row><row r="1048576"><c r="XFD1048576" t="str"><v>bottom</v></c></row></sheetData>',
        ),
    }).Sheets.S;
    expect(ws.XFD1048576).toBeDefined();
    expect(convert(ws)).toEqual({ data: [], rows: 0, cols: 0, merges: [], colWidths: [], tooLarge: true });
  });

  it('refuses a merge anchored at A1 spanning the whole grid', () => {
    const ws = roundTrip({ S: XLSX.utils.aoa_to_sheet([['x']]) }, {
      1: (xml) => addMerges('A1:XFD1048576')(setDimension('A1:XFD1048576')(xml)),
    }).Sheets.S;
    expect(convert(ws).tooLarge).toBe(true);
  });

  it('clips a merge that runs past the clamped range', () => {
    // B2 is empty, so the merge anchored there does not widen the range
    const ws = roundTrip({ S: XLSX.utils.aoa_to_sheet([['a', 'b'], ['c', null]]) }, {
      1: (xml) => addMerges('B2:XFD1048576', 'K20:L21')(setDimension('A1:XFD1048576')(xml)),
    }).Sheets.S;
    const out = convert(ws);
    expect(out.tooLarge).toBeUndefined();
    expect(out.merges).toEqual([XLSX.utils.decode_range('B2:B2')]);
  });

  it('returns the empty shape for a sheet with no cells in range', () => {
    const ws = roundTrip({ S: XLSX.utils.aoa_to_sheet([]) }).Sheets.S;
    expect(convert(ws)).toEqual({ data: [], rows: 0, cols: 0, merges: [], colWidths: [] });
    expect(convert({ '!ref': 'A1:XFD1048576' })).toEqual({ data: [], rows: 0, cols: 0, merges: [], colWidths: [] });
  });

  it('respects custom limits', () => {
    const ws = roundTrip({ S: XLSX.utils.aoa_to_sheet([[1, 2, 3], [4, 5, 6]]) }).Sheets.S;
    expect(convert(ws, resolveSheetLimits({ maxCells: 6 })).tooLarge).toBeUndefined();
    expect(convert(ws, resolveSheetLimits({ maxCells: 5 })).tooLarge).toBe(true);
    expect(convert(ws, resolveSheetLimits({ maxRows: 1 })).tooLarge).toBe(true);
    expect(convert(ws, resolveSheetLimits({ maxCols: 2 })).tooLarge).toBe(true);
  });
});
