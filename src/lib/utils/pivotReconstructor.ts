/**
 * Pivot Table Reconstructor
 *
 * Reads pivot table definitions and cache data from the raw XLSX zip,
 * then reconstructs the pivot table output using the already-parsed
 * sheet data.
 */
import { unzipSync, strFromU8 } from 'fflate';
import type { SheetData, CellValue } from '../types';

// ============================================================
// Internal interfaces
// ============================================================

interface PivotField {
  name: string;
  isRow: boolean;
  isCol: boolean;
  isData: boolean;
}

interface DataFieldDef {
  name: string;
  fieldIndex: number;
  subtotal: string;
}

interface PivotLocation {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

interface PivotDef {
  location: PivotLocation;
  fields: PivotField[];
  rowFields: number[];
  dataFields: DataFieldDef[];
}

interface CacheDef {
  sourceSheet: string;
  sourceRef: string;
  fields: { name: string }[];
}

type ZipEntries = Record<string, Uint8Array>;

// ============================================================
// Public API
// ============================================================

/**
 * Reconstruct pivot tables for sheets that are empty/near-empty.
 */
export function reconstructPivotTables(
  buffer: ArrayBuffer,
  sheets: Record<string, SheetData>,
  sheetNames: string[],
): Record<string, SheetData> {
  try {
    const uint8 = new Uint8Array(buffer);
    const zip = unzipSync(uint8);

    const workbookXml = readZipText(zip, 'xl/workbook.xml');
    if (!workbookXml) return sheets;

    const workbookRels = readZipText(zip, 'xl/_rels/workbook.xml.rels');
    if (!workbookRels) return sheets;

    const sheetRIdMap = parseSheetRIds(workbookXml);
    const rIdToFile = parseRelsTargets(workbookRels);

    for (const sheetName of sheetNames) {
      const sheetData = sheets[sheetName];
      if (!sheetData) continue;

      const nonEmptyRows = countNonEmptyRows(sheetData.data);
      if (nonEmptyRows > 5) continue;

      const rId = sheetRIdMap[sheetName];
      if (!rId) continue;

      const sheetFile = rIdToFile[rId];
      if (!sheetFile) continue;

      const sheetRelsPath = `xl/worksheets/_rels/${sheetFile.split('/').pop()}.rels`;
      const sheetRels = readZipText(zip, sheetRelsPath);
      if (!sheetRels) continue;

      const pivotTableRefs = findPivotTableRefs(sheetRels);
      if (pivotTableRefs.length === 0) continue;

      for (const pivotRef of pivotTableRefs) {
        const pivotXml = readZipText(zip, `xl/${pivotRef}`);
        if (!pivotXml) continue;

        const pivotDef = parsePivotTableDef(pivotXml);
        if (!pivotDef) continue;

        const pivotRelsPath = `xl/${pivotRef.replace(/[^/]*$/, '_rels/' + pivotRef.split('/').pop() + '.rels')}`;
        const pivotRels = readZipText(zip, pivotRelsPath);
        if (!pivotRels) continue;

        const cacheDefRef = findCacheDefRef(pivotRels);
        if (!cacheDefRef) continue;

        const cacheDefXml = readZipText(zip, `xl/${cacheDefRef}`);
        if (!cacheDefXml) continue;

        const cacheDef = parseCacheDefinition(cacheDefXml);
        if (!cacheDef || !cacheDef.sourceSheet || !cacheDef.sourceRef) continue;

        const sourceSheet = sheets[cacheDef.sourceSheet];
        if (!sourceSheet) continue;

        const pivotResult = computePivot(sourceSheet.data, cacheDef, pivotDef);

        if (pivotResult && pivotResult.length > 0) {
          fillPivotData(sheetData, pivotDef.location, pivotResult);
        }
      }
    }
  } catch (err) {
    console.warn('Pivot table reconstruction failed (non-fatal):', (err as Error).message);
  }

  return sheets;
}

// ============================================================
// ZIP reading helpers
// ============================================================

function readZipText(zip: ZipEntries, path: string): string | null {
  const entry = zip[path];
  if (!entry) return null;
  return strFromU8(entry);
}

// ============================================================
// XML parsing helpers
// ============================================================

function parseSheetRIds(xml: string): Record<string, string> {
  const map: Record<string, string> = {};
  const re = /name="([^"]*)"[^>]*r:id="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    map[m[1]] = m[2];
  }
  return map;
}

function parseRelsTargets(xml: string): Record<string, string> {
  const map: Record<string, string> = {};
  const re = /Id="([^"]*)"[^>]*Target="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    map[m[1]] = m[2];
  }
  return map;
}

function findPivotTableRefs(relsXml: string): string[] {
  const refs: string[] = [];
  const re = /Type="[^"]*pivotTable"[^>]*Target="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(relsXml))) {
    refs.push(m[1].replace(/^\.\.\//, ''));
  }
  return refs;
}

function findCacheDefRef(relsXml: string): string | null {
  const re = /Type="[^"]*pivotCacheDefinition"[^>]*Target="([^"]*)"/;
  const m = relsXml.match(re);
  if (!m) return null;
  return m[1].replace(/^\.\.\//, '');
}

// ============================================================
// Pivot Table Definition parser
// ============================================================

function parsePivotTableDef(xml: string): PivotDef | null {
  const locMatch = xml.match(/location[^>]*ref="([^"]*)"/);
  if (!locMatch) return null;

  const location = parseRef(locMatch[1]);

  const fields: PivotField[] = [];
  const fieldRe = /<pivotField[^>]*name="([^"]*)"([^>]*)>/g;
  let fm: RegExpExecArray | null;
  while ((fm = fieldRe.exec(xml))) {
    const name = fm[1];
    const attrs = fm[2];
    fields.push({
      name,
      isRow: attrs.includes('axis="axisRow"'),
      isCol: attrs.includes('axis="axisCol"'),
      isData: attrs.includes('dataField="1"'),
    });
  }

  const rowFields: number[] = [];
  const rowFieldRe = /<rowFields>([^]*?)<\/rowFields>/;
  const rowFieldsMatch = xml.match(rowFieldRe);
  if (rowFieldsMatch) {
    const fieldXRe = /<field\s+x="(\d+)"/g;
    let xm: RegExpExecArray | null;
    while ((xm = fieldXRe.exec(rowFieldsMatch[1]))) {
      rowFields.push(parseInt(xm[1]));
    }
  }

  const dataFields: DataFieldDef[] = [];
  const dataFieldRe = /<dataField[^>]*name="([^"]*)"[^>]*fld="(\d+)"[^>]*subtotal="([^"]*)"/g;
  let dfm: RegExpExecArray | null;
  while ((dfm = dataFieldRe.exec(xml))) {
    dataFields.push({
      name: dfm[1],
      fieldIndex: parseInt(dfm[2]),
      subtotal: dfm[3],
    });
  }

  return { location, fields, rowFields, dataFields };
}

function parseCacheDefinition(xml: string): CacheDef | null {
  const srcMatch = xml.match(/worksheetSource[^>]*ref="([^"]*)"[^>]*sheet="([^"]*)"/);
  if (!srcMatch) {
    const srcMatch2 = xml.match(/worksheetSource[^>]*sheet="([^"]*)"[^>]*ref="([^"]*)"/);
    if (!srcMatch2) return null;
    return {
      sourceSheet: srcMatch2[1],
      sourceRef: srcMatch2[2],
      fields: parseCacheFields(xml),
    };
  }
  return {
    sourceSheet: srcMatch[2],
    sourceRef: srcMatch[1],
    fields: parseCacheFields(xml),
  };
}

function parseCacheFields(xml: string): { name: string }[] {
  const fields: { name: string }[] = [];
  const fieldRe = /<cacheField[^>]*name="([^"]*)"[^>]*>/g;
  let fm: RegExpExecArray | null;
  while ((fm = fieldRe.exec(xml))) {
    fields.push({ name: fm[1] });
  }
  return fields;
}

// ============================================================
// Reference parsing
// ============================================================

function parseRef(ref: string): PivotLocation {
  const parts = ref.split(':');
  const start = cellToRC(parts[0]);
  const end = parts.length > 1 ? cellToRC(parts[1]) : start;
  return {
    startRow: start.row,
    startCol: start.col,
    endRow: end.row,
    endCol: end.col,
  };
}

function cellToRC(cell: string): { row: number; col: number } {
  const match = cell.match(/^([A-Z]+)(\d+)$/);
  if (!match) return { row: 0, col: 0 };
  let col = 0;
  for (const ch of match[1]) {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }
  return { row: parseInt(match[2]) - 1, col: col - 1 };
}

// ============================================================
// Pivot computation
// ============================================================

function computePivot(
  sourceData: CellValue[][],
  cacheDef: CacheDef,
  pivotDef: PivotDef,
): CellValue[][] | null {
  if (!pivotDef.rowFields.length || !pivotDef.dataFields.length) return null;

  const srcRef = parseRef(cacheDef.sourceRef);
  const srcStartCol = srcRef.startCol;
  const srcStartRow = srcRef.startRow;

  const rowFieldIdx = pivotDef.rowFields[0];
  const dataFieldDef = pivotDef.dataFields[0];

  const rowColIdx = srcStartCol + rowFieldIdx;
  const dataColIdx = srcStartCol + dataFieldDef.fieldIndex;

  const groups = new Map<string, CellValue[]>();

  for (let r = srcStartRow + 1; r < sourceData.length; r++) {
    const row = sourceData[r];
    if (!row) continue;

    const groupKey = String(row[rowColIdx] ?? '');
    if (!groupKey && groupKey !== '0') continue;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(row[dataColIdx]);
  }

  const result: CellValue[][] = [];
  const headerRow = pivotDef.fields[rowFieldIdx]?.name || 'Value';
  const dataHeader = dataFieldDef.name || 'Count';

  result.push([headerRow, dataHeader]);

  const sortedKeys = [...groups.keys()].sort((a, b) => {
    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  for (const key of sortedKeys) {
    const values = groups.get(key)!;
    let aggregated: number;

    switch (dataFieldDef.subtotal) {
      case 'count':
        aggregated = values.length;
        break;
      case 'sum':
        aggregated = values.reduce((s: number, v) => s + (parseFloat(String(v)) || 0), 0);
        break;
      case 'average':
        aggregated = values.reduce((s: number, v) => s + (parseFloat(String(v)) || 0), 0) / values.length;
        break;
      case 'min':
        aggregated = Math.min(...values.map((v) => parseFloat(String(v)) || 0));
        break;
      case 'max':
        aggregated = Math.max(...values.map((v) => parseFloat(String(v)) || 0));
        break;
      default:
        aggregated = values.length;
    }

    const displayKey = formatPivotValue(key);
    result.push([displayKey, aggregated]);
  }

  const allValues = [...groups.values()].flat();
  let grandTotal: number;
  switch (dataFieldDef.subtotal) {
    case 'count':
      grandTotal = allValues.length;
      break;
    case 'sum':
      grandTotal = allValues.reduce((s: number, v) => s + (parseFloat(String(v)) || 0), 0);
      break;
    case 'average':
      grandTotal = allValues.reduce((s: number, v) => s + (parseFloat(String(v)) || 0), 0) / allValues.length;
      break;
    default:
      grandTotal = allValues.length;
  }
  result.push(['Grand Total', grandTotal]);

  return result;
}

function formatPivotValue(val: string): string {
  const num = parseFloat(val);
  if (!isNaN(num) && String(num) === val) {
    return val;
  }
  if (!isNaN(num)) {
    return String(Math.round(num * 10000) / 10000);
  }
  return val;
}

// ============================================================
// Fill pivot data into sheet
// ============================================================

function fillPivotData(
  sheetData: SheetData,
  location: PivotLocation,
  pivotResult: CellValue[][],
): void {
  const { startRow, startCol } = location;

  const neededRows = startRow + pivotResult.length;
  const neededCols = startCol + (pivotResult[0]?.length || 0);

  while (sheetData.data.length < neededRows) {
    sheetData.data.push([]);
  }

  for (let i = 0; i < pivotResult.length; i++) {
    const targetRow = startRow + i;
    const row = sheetData.data[targetRow];

    while (row.length < startCol) {
      row.push('');
    }

    for (let j = 0; j < pivotResult[i].length; j++) {
      row[startCol + j] = pivotResult[i][j];
    }
  }

  sheetData.rows = Math.max(sheetData.rows, neededRows);
  sheetData.cols = Math.max(sheetData.cols, neededCols);
}

function countNonEmptyRows(data: CellValue[][]): number {
  let count = 0;
  for (const row of data) {
    if (row && row.some((cell) => cell !== '' && cell !== undefined && cell !== null)) {
      count++;
    }
  }
  return count;
}
