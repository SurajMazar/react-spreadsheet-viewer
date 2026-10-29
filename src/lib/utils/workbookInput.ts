/**
 * Building the viewer's `SheetData` from plain data (the `data` prop), and
 * reading a sheet back out in the same row-and-cell shape (`getCellRows`).
 *
 * The cell shape is close to the cell model of grid libraries such as
 * Syncfusion's spreadsheet — `{ value, formula, format, style, … }` per cell,
 * rows of cells per sheet — so an existing JSON payload maps over with a
 * shallow rename at most.
 */
import type {
  CellComment,
  CellMeta,
  CellStyle,
  CellValue,
  MergeCell,
  SheetCellInput,
  SheetData,
  SheetInput,
  ValidationRule,
  WorkbookInput,
} from '../types';

export const DEFAULT_WORKBOOK_FILE_NAME = 'workbook.xlsx';

function isCellInput(entry: SheetCellInput | CellValue): entry is SheetCellInput {
  return typeof entry === 'object' && entry !== null;
}

/** Build one sheet from rows of plain values or cell objects. */
export function buildSheetFromRows(input: SheetInput): SheetData {
  const data: CellValue[][] = [];
  const merges: MergeCell[] = [...(input.merges ?? [])];
  const styles: Record<string, CellStyle> = {};
  const formulas: Record<string, string> = {};
  const formats: Record<string, string> = {};
  const meta: Record<string, CellMeta> = {};
  const validations: Record<string, ValidationRule> = {};
  const comments: Record<string, CellComment> = {};

  let rows = 0;
  let cols = 0;

  input.rows.forEach((row, r) => {
    const out: CellValue[] = [];
    (row ?? []).forEach((entry, c) => {
      if (!isCellInput(entry)) {
        out[c] = entry === undefined ? null : entry;
        if (entry !== null && entry !== undefined && entry !== '') {
          rows = Math.max(rows, r + 1);
          cols = Math.max(cols, c + 1);
        }
        return;
      }

      const key = `${r},${c}`;
      out[c] = entry.value === undefined ? null : entry.value;
      if (entry.formula) formulas[key] = entry.formula.startsWith('=') ? entry.formula : `=${entry.formula}`;
      if (entry.format) formats[key] = entry.format;
      if (entry.style && Object.keys(entry.style).length > 0) styles[key] = { ...entry.style };
      if (entry.meta) meta[key] = entry.meta;
      if (entry.validation) validations[key] = entry.validation;
      if (entry.comment) comments[key] = entry.comment;

      const colSpan = Math.max(1, Math.floor(entry.colSpan ?? 1));
      const rowSpan = Math.max(1, Math.floor(entry.rowSpan ?? 1));
      if (colSpan > 1 || rowSpan > 1) {
        merges.push({ s: { r, c }, e: { r: r + rowSpan - 1, c: c + colSpan - 1 } });
      }

      // Any cell object counts towards the used range, even an empty one: it
      // may carry a style or a dropdown the user is meant to fill in.
      rows = Math.max(rows, r + rowSpan);
      cols = Math.max(cols, c + colSpan);
    });
    // Fill holes left by sparse rows so every cell reads as null.
    for (let c = 0; c < out.length; c++) if (out[c] === undefined) out[c] = null;
    data.push(out);
  });

  for (const m of merges) {
    rows = Math.max(rows, m.e.r + 1);
    cols = Math.max(cols, m.e.c + 1);
  }

  const sheet: SheetData = {
    data,
    rows,
    cols,
    merges,
    colWidths: input.colWidths ? [...input.colWidths] : [],
  };
  if (input.rowHeights) sheet.rowHeights = [...input.rowHeights];
  if (Object.keys(styles).length > 0) sheet.styles = styles;
  if (Object.keys(formulas).length > 0) sheet.formulas = formulas;
  if (Object.keys(formats).length > 0) sheet.formats = formats;
  if (Object.keys(meta).length > 0) sheet.meta = meta;
  if (Object.keys(validations).length > 0) sheet.validations = validations;
  if (Object.keys(comments).length > 0) sheet.comments = comments;
  if (input.hiddenCols?.length) sheet.hiddenCols = [...input.hiddenCols];
  if (input.frozenRows && input.frozenRows > 0) sheet.frozenRows = Math.floor(input.frozenRows);
  if (input.frozenCols && input.frozenCols > 0) sheet.frozenCols = Math.floor(input.frozenCols);
  if (input.readOnly) sheet.readOnly = true;
  return sheet;
}

/**
 * Build a whole workbook. Sheet names are made unique (a repeated name gets
 * ` (2)`, ` (3)` …) because the viewer keys sheets by name.
 */
export function buildWorkbook(input: WorkbookInput): {
  fileName: string;
  sheetNames: string[];
  sheets: Record<string, SheetData>;
} {
  const sheetNames: string[] = [];
  const sheets: Record<string, SheetData> = {};
  for (const sheetInput of input.sheets ?? []) {
    const base = sheetInput.name?.trim() || `Sheet${sheetNames.length + 1}`;
    let name = base;
    for (let n = 2; Object.prototype.hasOwnProperty.call(sheets, name); n++) name = `${base} (${n})`;
    sheetNames.push(name);
    sheets[name] = buildSheetFromRows(sheetInput);
  }
  return { fileName: input.fileName || DEFAULT_WORKBOOK_FILE_NAME, sheetNames, sheets };
}

/**
 * Read a sheet back as rows of cells — the inverse of `buildSheetFromRows`.
 * Every cell in the used range is an object (`{}` when empty); merged areas
 * are reported as `colSpan`/`rowSpan` on their top-left cell. Formula cells
 * carry both the formula and its last computed value.
 */
export function sheetToCellRows(sheet: SheetData): SheetCellInput[][] {
  const spans = new Map<string, { colSpan: number; rowSpan: number }>();
  for (const m of sheet.merges ?? []) {
    spans.set(`${m.s.r},${m.s.c}`, { colSpan: m.e.c - m.s.c + 1, rowSpan: m.e.r - m.s.r + 1 });
  }

  const out: SheetCellInput[][] = [];
  for (let r = 0; r < sheet.rows; r++) {
    const row: SheetCellInput[] = [];
    for (let c = 0; c < sheet.cols; c++) {
      const key = `${r},${c}`;
      const cell: SheetCellInput = {};
      const value = sheet.data[r]?.[c];
      if (value !== null && value !== undefined && value !== '') cell.value = value;
      const formula = sheet.formulas?.[key];
      if (formula) cell.formula = formula;
      const format = sheet.formats?.[key];
      if (format) cell.format = format;
      const style = sheet.styles?.[key];
      if (style) cell.style = { ...style };
      const meta = sheet.meta?.[key];
      if (meta) cell.meta = meta;
      const validation = sheet.validations?.[key];
      if (validation) cell.validation = validation;
      const comment = sheet.comments?.[key];
      if (comment) cell.comment = comment;
      const span = spans.get(key);
      if (span) {
        if (span.colSpan > 1) cell.colSpan = span.colSpan;
        if (span.rowSpan > 1) cell.rowSpan = span.rowSpan;
      }
      row.push(cell);
    }
    out.push(row);
  }
  return out;
}
