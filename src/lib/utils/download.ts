/**
 * Download utilities for exporting sheet data as XLSX or CSV.
 */

import type { SheetData, CellValue } from '../types';

/**
 * Download the current sheets as an XLSX file.
 */
export async function downloadAsXlsx(
  sheets: Record<string, SheetData>,
  sheetNames: string[],
  fileName: string | null,
): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  for (const name of sheetNames) {
    const sheet = sheets[name];
    if (!sheet) continue;
    const ws = XLSX.utils.aoa_to_sheet(sheet.data as unknown[][]);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  const outName = fileName
    ? fileName.replace(/\.[^.]+$/, '') + '_export.xlsx'
    : 'export.xlsx';

  XLSX.writeFile(wb, outName);
}

/**
 * Download a single sheet as a CSV file.
 */
export function downloadAsCsv(sheetData: SheetData | null, sheetName: string | null): void {
  if (!sheetData || !sheetData.data) return;

  const csvContent = sheetData.data
    .map((row: CellValue[]) =>
      row
        .map((cell: CellValue) => {
          const val = String(cell ?? '');
          // Escape fields containing commas, quotes, or newlines
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        })
        .join(',')
    )
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sheetName || 'sheet'}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
