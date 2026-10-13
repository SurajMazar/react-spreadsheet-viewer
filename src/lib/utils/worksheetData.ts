/**
 * Turning one SheetJS worksheet into the viewer's `SheetData`.
 *
 * `xlsx` is only imported for its types: the parser loads it lazily and hands
 * its `utils` in, so this module adds nothing to the main bundle.
 */
import type { WorkSheet, utils as SheetJsUtils } from 'xlsx';
import { buildColWidths, type ColInfo } from './columnWidths';
import { planSheetBounds, type ResolvedSheetLimits, type SheetRange } from './sheetBounds';
import type { CellValue, SheetData } from '../types';

/** The parts of `XLSX.utils` this module uses. */
export type WorksheetUtils = Pick<typeof SheetJsUtils, 'decode_range' | 'decode_cell' | 'sheet_to_json'>;

/** The shape every sheet without cells gets. */
export function emptySheetData(colWidths: number[] = []): SheetData {
  return { data: [], cols: 0, rows: 0, merges: [], colWidths };
}

/**
 * Parse one worksheet, reading only the range it really uses.
 *
 * A sheet that would need more cells than `limits` allow comes back marked
 * `tooLarge` with no data, so the grid can say so instead of the tab hanging;
 * the rest of the workbook is unaffected.
 */
export function worksheetToSheetData(
  worksheet: WorkSheet,
  utils: WorksheetUtils,
  limits: ResolvedSheetLimits,
): SheetData {
  const ref = worksheet['!ref'];
  if (!ref) return emptySheetData();

  const colWidths = buildColWidths(worksheet['!cols'] as ColInfo[] | undefined);

  const plan = planSheetBounds(
    worksheet as unknown as Record<string, unknown>,
    utils.decode_range(ref),
    worksheet['!merges'] as SheetRange[] | undefined,
    limits,
    utils.decode_cell,
  );

  if (plan.kind === 'empty') return emptySheetData(colWidths);
  if (plan.kind === 'tooLarge') return { ...emptySheetData(), tooLarge: true };

  const { range } = plan;
  const rangeStartRow = range.s.r;
  const rangeStartCol = range.s.c;

  // `range` makes SheetJS walk the bounded range instead of the declared `!ref`
  // — same result as rewriting `!ref`, without touching the worksheet.
  const rawData: CellValue[][] = utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: true,
    raw: false,
    range: { s: { ...range.s }, e: { ...range.e } },
  }) as CellValue[][];

  let data: CellValue[][];
  const totalRows = range.e.r + 1;
  const totalCols = range.e.c + 1;

  if (rangeStartRow === 0 && rangeStartCol === 0) {
    data = rawData;
  } else {
    data = [];
    for (let r = 0; r < rangeStartRow; r++) {
      data.push([]);
    }
    for (const row of rawData) {
      if (rangeStartCol > 0) {
        const paddedRow: CellValue[] = new Array(rangeStartCol).fill('');
        paddedRow.push(...row);
        data.push(paddedRow);
      } else {
        data.push(row);
      }
    }
  }

  const rows = Math.max(totalRows, data.length);
  const cols = Math.max(
    totalCols,
    data.reduce((max, row) => Math.max(max, row.length), 0)
  );

  const merges = plan.merges.map((m) => ({
    s: { r: m.s.r, c: m.s.c },
    e: { r: m.e.r, c: m.e.c },
  }));

  return { data, cols, rows, merges, colWidths };
}
