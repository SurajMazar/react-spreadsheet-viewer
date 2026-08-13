import { useCallback, useRef } from 'react';
import { useViewerStore } from '../context/ViewerContext';
import { buildColWidths, type ColInfo } from '../utils/columnWidths';
import type { SheetData, CellValue } from '../types';

/**
 * Hook to manage file parsing.
 *
 * Uses main-thread parsing with dynamic import() for xlsx.
 * requestAnimationFrame is used between steps to keep the UI responsive.
 */
export function useFileParser(): { parseBuffer: (buffer: ArrayBuffer, fileName: string) => Promise<void> } {
  const startParsing = useViewerStore((s) => s.startParsing);
  const setParseProgress = useViewerStore((s) => s.setParseProgress);
  const setFileData = useViewerStore((s) => s.setFileData);
  const setParseError = useViewerStore((s) => s.setParseError);
  const parsingRef = useRef(false);

  const parseBuffer = useCallback(
    async (buffer: ArrayBuffer, fileName: string) => {
      if (!buffer || parsingRef.current) return;
      parsingRef.current = true;

      const extension = fileName.split('.').pop()?.toLowerCase() ?? '';

      try {
        startParsing();
        await nextFrame();

        if (extension === 'csv') {
          const text = new TextDecoder().decode(buffer);
          await parseCSVText(text, fileName, setParseProgress, setFileData);
        } else {
          await parseExcelBuffer(buffer, fileName, setParseProgress, setFileData);
        }
      } catch (err) {
        console.error('Parse error:', err);
        setParseError((err as Error).message || 'Failed to parse file');
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
    const ref = worksheet['!ref'];

    if (!ref) {
      sheets[name] = { data: [], cols: 0, rows: 0, merges: [], colWidths: [] };
      continue;
    }

    const range = XLSX.utils.decode_range(ref);
    const rangeStartRow = range.s.r;
    const rangeStartCol = range.s.c;
    const rangeEndRow = range.e.r;
    const rangeEndCol = range.e.c;

    const rawData: CellValue[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: true,
      raw: false,
    }) as CellValue[][];

    let data: CellValue[][];
    const totalRows = rangeEndRow + 1;
    const totalCols = rangeEndCol + 1;

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

    const merges = (worksheet['!merges'] || []).map((m: { s: { r: number; c: number }; e: { r: number; c: number } }) => ({
      s: { r: m.s.r, c: m.s.c },
      e: { r: m.e.r, c: m.e.c },
    }));

    const colWidths = buildColWidths(worksheet['!cols'] as ColInfo[] | undefined);

    sheets[name] = { data, cols, rows, merges, colWidths };

    const progress = 45 + ((i + 1) / totalSheets) * 45;
    setParseProgress(progress, `Parsed sheet "${name}"...`);
    await nextFrame();
  }

  // Reconstruct pivot tables
  setParseProgress(88, 'Reconstructing pivot tables...');
  await nextFrame();

  try {
    const { reconstructPivotTables } = await import('../utils/pivotReconstructor');
    reconstructPivotTables(buffer, sheets, sheetNames);
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
    chartOverlays = extractChartOverlays(buffer, sheets, sheetNames);
  } catch (err) {
    console.warn('Chart extraction skipped:', (err as Error).message);
  }

  // Extract cell styles (background colors, font colors, bold, etc.)
  setParseProgress(94, 'Extracting styles...');
  await nextFrame();

  try {
    const { extractSheetStyles } = await import('../utils/styleExtractor');
    const sheetStyles = extractSheetStyles(buffer, sheetNames);
    for (const name of sheetNames) {
      if (sheetStyles[name] && sheets[name]) {
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
  setParseProgress: SetProgressFn,
  setFileData: SetFileDataFn,
): Promise<void> {
  setParseProgress(10, 'Reading CSV...');
  await nextFrame();

  setParseProgress(20, 'Parsing rows...');
  await nextFrame();

  const lines = text.split('\n');
  const totalLines = lines.length;
  const data: CellValue[][] = [];
  let maxCols = 0;

  const CHUNK_SIZE = 5000;

  for (let i = 0; i < totalLines; i += CHUNK_SIZE) {
    const end = Math.min(i + CHUNK_SIZE, totalLines);

    for (let j = i; j < end; j++) {
      const row = parseCSVLine(lines[j]);
      if (row.length > maxCols) maxCols = row.length;
      data.push(row);
    }

    const progress = 20 + (end / totalLines) * 70;
    setParseProgress(Math.min(progress, 92), `Parsed ${end.toLocaleString()} of ${totalLines.toLocaleString()} rows...`);
    await nextFrame();
  }

  // Remove trailing empty rows
  while (data.length > 0 && (data[data.length - 1] as string[]).every((c) => c === '')) {
    data.pop();
  }

  setParseProgress(95, 'Finalizing...');
  await nextFrame();

  const sheetName = 'Sheet1';
  setFileData({
    fileName,
    sheetNames: [sheetName],
    sheets: {
      [sheetName]: {
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

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else if (char === '\r') {
        // skip
      } else {
        current += char;
      }
    }
  }

  result.push(current.trim());
  return result;
}
