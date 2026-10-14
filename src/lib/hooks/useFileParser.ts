import { useCallback, useRef } from 'react';
import { useViewerStore } from '../context/ViewerContext';
import { exceedsSheetLimits, resolveSheetLimits, type ResolvedSheetLimits } from '../utils/sheetBounds';
import { isBlankCsvRow, readCsvRows } from '../utils/csvParser';
import { worksheetToSheetData } from '../utils/worksheetData';
import type { SheetData, CellValue, SheetViewerLimits } from '../types';

export interface FileParserOptions {
  /** Per-sheet parse limits; defaults fill in anything left out. */
  limits?: SheetViewerLimits;
  /** Called with the error when parsing fails. */
  onError?: (error: Error) => void;
}

/**
 * Hook to manage file parsing.
 *
 * Uses main-thread parsing with dynamic import() for xlsx.
 * requestAnimationFrame is used between steps to keep the UI responsive.
 */
export function useFileParser(
  options: FileParserOptions = {},
): { parseBuffer: (buffer: ArrayBuffer, fileName: string) => Promise<void> } {
  const startParsing = useViewerStore((s) => s.startParsing);
  const setParseProgress = useViewerStore((s) => s.setParseProgress);
  const setFileData = useViewerStore((s) => s.setFileData);
  const setParseError = useViewerStore((s) => s.setParseError);
  const parsingRef = useRef(false);

  // Read at parse time through a ref, so inline `limits`/`onError` values do
  // not give parseBuffer a new identity every render (and re-trigger parsing).
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const parseBuffer = useCallback(
    async (buffer: ArrayBuffer, fileName: string) => {
      if (!buffer || parsingRef.current) return;
      parsingRef.current = true;

      const extension = fileName.split('.').pop()?.toLowerCase() ?? '';

      try {
        startParsing();
        await nextFrame();

        const limits = resolveSheetLimits(optionsRef.current.limits);
        if (extension === 'csv') {
          const text = new TextDecoder().decode(buffer);
          await parseCSVText(text, fileName, limits, setParseProgress, setFileData);
        } else {
          await parseExcelBuffer(buffer, fileName, limits, setParseProgress, setFileData);
        }
      } catch (err) {
        console.error('Parse error:', err);
        const error = err instanceof Error ? err : new Error(String(err));
        setParseError(error.message || 'Failed to parse file');
        optionsRef.current.onError?.(error);
      } finally {
        parsingRef.current = false;
      }
    },
    [startParsing, setParseProgress, setFileData, setParseError]
  );

  return { parseBuffer };
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

type SetProgressFn = (progress: number, status?: string) => void;
type SetFileDataFn = (payload: {
  fileName: string;
  sheetNames: string[];
  sheets: Record<string, SheetData>;
  images?: Record<string, unknown>;
  chartOverlays?: Record<string, import('../types').ChartOverlay[]>;
}) => void;

async function parseExcelBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  limits: ResolvedSheetLimits,
  setParseProgress: SetProgressFn,
  setFileData: SetFileDataFn,
): Promise<void> {
  setParseProgress(5, 'Loading parser...');
  await nextFrame();

  const XLSX = await import('xlsx');

  setParseProgress(15, 'Reading file...');
  await nextFrame();

  setParseProgress(25, 'Parsing workbook...');
  await nextFrame();

  // cellStyles is what makes SheetJS parse `<cols>` into `!cols`; without it the
  // column widths the author set in Excel are dropped on the floor.
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    cellNF: true,
    sheetStubs: true,
    cellStyles: true,
  });

  setParseProgress(45, 'Processing sheets...');
  await nextFrame();

  const sheetNames = workbook.SheetNames;
  const sheets: Record<string, SheetData> = {};
  const totalSheets = sheetNames.length;

  for (let i = 0; i < totalSheets; i++) {
    const name = sheetNames[i];
    const worksheet = workbook.Sheets[name];

    if (!worksheet['!ref']) {
      sheets[name] = { data: [], cols: 0, rows: 0, merges: [], colWidths: [] };
      continue;
    }

    // Only the range the sheet really uses is read, and a sheet over `limits`
    // is marked tooLarge instead of parsed — see utils/sheetBounds.ts.
    sheets[name] = worksheetToSheetData(worksheet, XLSX.utils, limits);

    const progress = 45 + ((i + 1) / totalSheets) * 45;
    setParseProgress(progress, `Parsed sheet "${name}"...`);
    await nextFrame();
  }

  // Reconstruct pivot tables
  setParseProgress(88, 'Reconstructing pivot tables...');
  await nextFrame();

  try {
    const { reconstructPivotTables } = await import('../utils/pivotReconstructor');
    reconstructPivotTables(buffer, sheets, sheetNames, limits);
  } catch (err) {
    console.warn('Pivot reconstruction skipped:', (err as Error).message);
  }

  await nextFrame();

  // Extract embedded chart overlays
  setParseProgress(92, 'Extracting charts...');
  await nextFrame();

  let chartOverlays: Record<string, import('../types').ChartOverlay[]> = {};
  try {
    const { extractChartOverlays } = await import('../utils/chartExtractor');
    chartOverlays = extractChartOverlays(buffer, sheets, sheetNames, limits.maxCells);
  } catch (err) {
    console.warn('Chart extraction skipped:', (err as Error).message);
  }

  // Extract cell styles (background colors, font colors, bold, etc.)
  setParseProgress(94, 'Extracting styles...');
  await nextFrame();

  try {
    const { extractSheetStyles } = await import('../utils/styleExtractor');
    // A refused sheet shows no grid, so reading its styles is wasted work.
    const sheetStyles = extractSheetStyles(buffer, sheetNames, (name) => !!sheets[name]?.tooLarge);
    for (const name of sheetNames) {
      if (sheetStyles[name] && sheets[name] && !sheets[name].tooLarge) {
        sheets[name].styles = sheetStyles[name];
      }
    }
  } catch (err) {
    console.warn('Style extraction skipped:', (err as Error).message);
  }

  // Extract images (best-effort)
  const images: Record<string, unknown> = {};
  try {
    for (const name of sheetNames) {
      const ws = workbook.Sheets[name] as Record<string, unknown>;
      if (ws['!images']) {
        images[name] = ws['!images'];
      }
    }
  } catch {
    // Image extraction is optional
  }

  setParseProgress(97, 'Finalizing...');
  await nextFrame();

  setFileData({ fileName, sheetNames, sheets, images, chartOverlays });
}

async function parseCSVText(
  text: string,
  fileName: string,
  limits: ResolvedSheetLimits,
  setParseProgress: SetProgressFn,
  setFileData: SetFileDataFn,
): Promise<void> {
  setParseProgress(10, 'Reading CSV...');
  await nextFrame();

  setParseProgress(20, 'Parsing rows...');
  await nextFrame();

  const totalChars = text.length;
  const data: CellValue[][] = [];
  const rows = data as string[][];
  let maxCols = 0;
  // Rows up to and including the last one with content: trailing blank rows
  // are dropped at the end, so they do not count against the limits.
  let usedRows = 0;
  let tooLarge = false;

  const CHUNK_SIZE = 5000;
  let pos = 0;

  while (pos < totalChars) {
    const first = rows.length;
    pos = readCsvRows(text, pos, CHUNK_SIZE, rows);

    for (let j = first; j < rows.length; j++) {
      const row = rows[j];
      if (row.length > maxCols) maxCols = row.length;
      if (!isBlankCsvRow(row)) usedRows = j + 1;
    }

    // Stop as soon as the sheet is over budget rather than reading on
    if (exceedsSheetLimits(usedRows, maxCols, limits)) {
      tooLarge = true;
      break;
    }

    const progress = 20 + (pos / totalChars) * 70;
    setParseProgress(Math.min(progress, 92), `Parsed ${rows.length.toLocaleString()} rows...`);
    await nextFrame();
  }

  // Remove trailing empty rows
  data.length = tooLarge ? 0 : usedRows;

  setParseProgress(95, 'Finalizing...');
  await nextFrame();

  const sheetName = 'Sheet1';
  setFileData({
    fileName,
    sheetNames: [sheetName],
    sheets: {
      [sheetName]: tooLarge
        ? { data: [], cols: 0, rows: 0, merges: [], colWidths: [], tooLarge: true }
        : {
            data,
            cols: maxCols,
            rows: data.length,
            merges: [],
            colWidths: [],
          },
    },
    images: {},
  });
}
