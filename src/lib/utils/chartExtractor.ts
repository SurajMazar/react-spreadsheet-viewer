/**
 * Chart Extractor
 *
 * Reads embedded chart definitions and their drawing positions from the
 * raw XLSX zip, then returns overlay descriptors that can be rendered
 * as floating chart instances on top of the virtualized grid.
 */
import { unzipSync, strFromU8 } from 'fflate';
import type { SheetData, ChartOverlay, ChartType, ChartSeries, CellValue } from '../types';

// EMU to pixel conversion (96 DPI)
const EMU_PER_PX = 9525;

type ZipEntries = Record<string, Uint8Array>;

interface DrawingAnchor {
  col: number;
  row: number;
  colOff: number;
  rowOff: number;
  width: number;
  height: number;
  chartRId: string | null;
}

/**
 * Extract all embedded chart overlays for every sheet.
 */
export function extractChartOverlays(
  buffer: ArrayBuffer,
  sheets: Record<string, SheetData>,
  sheetNames: string[],
): Record<string, ChartOverlay[]> {
  const overlays: Record<string, ChartOverlay[]> = {};

  try {
    const uint8 = new Uint8Array(buffer);
    const zip = unzipSync(uint8);

    const wbXml = readZip(zip, 'xl/workbook.xml');
    const wbRels = readZip(zip, 'xl/_rels/workbook.xml.rels');
    if (!wbXml || !wbRels) return overlays;

    const sheetRIdMap = parseAttrs(wbXml, /name="([^"]*)"[^>]*r:id="([^"]*)"/g);
    const rIdToTarget = parseAttrs(wbRels, /Id="([^"]*)"[^>]*Target="([^"]*)"/g);

    for (const sheetName of sheetNames) {
      const rId = sheetRIdMap[sheetName];
      if (!rId) continue;
      const sheetFile = rIdToTarget[rId];
      if (!sheetFile) continue;

      const sheetXml = readZip(zip, `xl/${sheetFile}`);
      if (!sheetXml) continue;

      const drawingMatch = sheetXml.match(/drawing\s+r:id="([^"]*)"/);
      if (!drawingMatch) continue;
      const drawingRId = drawingMatch[1];

      const sheetRelsPath = `xl/worksheets/_rels/${sheetFile.split('/').pop()}.rels`;
      const sheetRels = readZip(zip, sheetRelsPath);
      if (!sheetRels) continue;

      const sheetRelMap = parseAttrs(sheetRels, /Id="([^"]*)"[^>]*Target="([^"]*)"/g);
      const drawingTarget = sheetRelMap[drawingRId];
      if (!drawingTarget) continue;
      const drawingPath = resolvePath('xl/worksheets/', drawingTarget);

      const drawingXml = readZip(zip, drawingPath);
      if (!drawingXml) continue;

      const anchors = parseDrawingAnchors(drawingXml);
      if (anchors.length === 0) continue;

      const drawingRelsPath = drawingPath.replace(/([^/]+)$/, '_rels/$1.rels');
      const drawingRels = readZip(zip, drawingRelsPath);
      const drawingRelMap = drawingRels
        ? parseAttrs(drawingRels, /Id="([^"]*)"[^>]*Target="([^"]*)"/g)
        : {};

      const chartOverlaysList: ChartOverlay[] = [];

      for (const anchor of anchors) {
        if (!anchor.chartRId) continue;
        const chartTarget = drawingRelMap[anchor.chartRId];
        if (!chartTarget) continue;
        const chartPath = resolvePath(drawingPath.replace(/[^/]+$/, ''), chartTarget);

        const chartXml = readZip(zip, chartPath);
        if (!chartXml) continue;

        const chartDef = parseChartXml(chartXml, sheets, sheetName);
        if (!chartDef) continue;

        chartOverlaysList.push({
          anchorCol: anchor.col,
          anchorRow: anchor.row,
          offsetX: anchor.colOff,
          offsetY: anchor.rowOff,
          width: anchor.width,
          height: anchor.height,
          ...chartDef,
        });
      }

      if (chartOverlaysList.length > 0) {
        overlays[sheetName] = chartOverlaysList;
      }
    }
  } catch (err) {
    console.warn('Chart extraction failed (non-fatal):', (err as Error).message);
  }

  return overlays;
}

// ================================================================
// ZIP / path helpers
// ================================================================

function readZip(zip: ZipEntries, path: string): string | null {
  const entry = zip[path];
  return entry ? strFromU8(entry) : null;
}

function resolvePath(base: string, relative: string): string {
  const baseParts = base.split('/').filter(Boolean);
  const relParts = relative.split('/');
  for (const part of relParts) {
    if (part === '..') baseParts.pop();
    else if (part !== '.') baseParts.push(part);
  }
  return baseParts.join('/');
}

function parseAttrs(xml: string, re: RegExp): Record<string, string> {
  const map: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) map[m[1]] = m[2];
  return map;
}

// ================================================================
// Drawing anchor parser
// ================================================================

function parseDrawingAnchors(xml: string): DrawingAnchor[] {
  const anchors: DrawingAnchor[] = [];

  const anchorRe = /<xdr:(oneCellAnchor|twoCellAnchor)>([\s\S]*?)<\/xdr:\1>/g;
  let am: RegExpExecArray | null;

  while ((am = anchorRe.exec(xml))) {
    const block = am[2];

    const fromCol = intAttr(block, /<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>/);
    const fromRow = intAttr(block, /<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
    const colOff = intAttr(block, /<xdr:from>[\s\S]*?<xdr:colOff>(\d+)<\/xdr:colOff>/);
    const rowOff = intAttr(block, /<xdr:from>[\s\S]*?<xdr:rowOff>(\d+)<\/xdr:rowOff>/);

    let width: number | undefined;
    let height: number | undefined;
    const extCx = intAttr(block, /<xdr:ext\s+cx="(\d+)"/);
    const extCy = intAttr(block, /cy="(\d+)"/);

    if (extCx && extCy) {
      width = Math.round(extCx / EMU_PER_PX);
      height = Math.round(extCy / EMU_PER_PX);
    } else {
      const toCol = intAttr(block, /<xdr:to>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>/);
      const toRow = intAttr(block, /<xdr:to>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
      width = Math.max(400, ((toCol || (fromCol ?? 0) + 6) - (fromCol ?? 0)) * 100);
      height = Math.max(250, ((toRow || (fromRow ?? 0) + 15) - (fromRow ?? 0)) * 26);
    }

    const chartRefMatch = block.match(/c:chart\s+r:id="([^"]*)"/);
    const chartRId = chartRefMatch ? chartRefMatch[1] : null;

    if (chartRId) {
      anchors.push({
        col: fromCol ?? 0,
        row: fromRow ?? 0,
        colOff: Math.round((colOff || 0) / EMU_PER_PX),
        rowOff: Math.round((rowOff || 0) / EMU_PER_PX),
        width: width || 500,
        height: height || 300,
        chartRId,
      });
    }
  }

  return anchors;
}

function intAttr(xml: string, re: RegExp): number | null {
  const m = xml.match(re);
  return m ? parseInt(m[1], 10) : null;
}

// ================================================================
// Chart XML parser
// ================================================================

function parseChartXml(
  xml: string,
  sheets: Record<string, SheetData>,
  currentSheet: string,
): { chartType: ChartType; title: string; series: ChartSeries[] } | null {
  let chartType: ChartType = 'bar';
  if (xml.includes('<c:lineChart>')) chartType = 'line';
  else if (xml.includes('<c:pieChart>') || xml.includes('<c:pie3DChart>')) chartType = 'pie';
  else if (xml.includes('<c:areaChart>')) chartType = 'area';
  else if (xml.includes('<c:scatterChart>')) chartType = 'scatter';

  const title = extractChartTitle(xml) || '';
  const series = extractSeries(xml, sheets, currentSheet);

  if (series.length === 0) return null;

  return { chartType, title, series };
}

function extractChartTitle(xml: string): string {
  const titleBlock = xml.match(/<c:title>([\s\S]*?)<\/c:title>/);
  if (!titleBlock) return '';
  const textMatch = titleBlock[1].match(/<a:t>([^<]*)<\/a:t>/);
  return textMatch ? textMatch[1] : '';
}

function extractSeries(
  xml: string,
  sheets: Record<string, SheetData>,
  currentSheet: string,
): ChartSeries[] {
  const series: ChartSeries[] = [];
  const serRe = /<c:ser>([\s\S]*?)<\/c:ser>/g;
  let sm: RegExpExecArray | null;

  while ((sm = serRe.exec(xml))) {
    const block = sm[1];

    const nameMatch = block.match(/<c:tx>[\s\S]*?<c:v>([^<]*)<\/c:v>/);
    const name = nameMatch ? nameMatch[1] : `Series ${series.length + 1}`;

    const catRef = extractCellRef(block, /<c:cat>[\s\S]*?<c:f>([^<]*)<\/c:f>/);
    const valRef = extractCellRef(block, /<c:val>[\s\S]*?<c:f>([^<]*)<\/c:f>/);

    const categories = catRef
      ? resolveReference(catRef, sheets, currentSheet)
      : [];
    const values = valRef
      ? resolveReference(valRef, sheets, currentSheet).map((v) => parseFloat(String(v)) || 0)
      : [];

    if (values.length > 0) {
      series.push({ name, categories, values });
    }
  }

  return series;
}

function extractCellRef(block: string, re: RegExp): string | null {
  const m = block.match(re);
  return m ? m[1] : null;
}

/**
 * Resolve an Excel cell reference like "Sheet1!$A$4:$A$54" to an array of values.
 */
function resolveReference(
  ref: string,
  sheets: Record<string, SheetData>,
  currentSheet: string,
): (string | number)[] {
  let sheetName = currentSheet;
  let rangeStr = ref;

  if (ref.includes('!')) {
    const parts = ref.split('!');
    sheetName = parts[0].replace(/^'|'$/g, '');
    rangeStr = parts[1];
  }

  const sheet = sheets[sheetName];
  if (!sheet) return [];

  rangeStr = rangeStr.replace(/\$/g, '');

  const rangeParts = rangeStr.split(':');
  const start = parseCellAddr(rangeParts[0]);
  const end = rangeParts.length > 1 ? parseCellAddr(rangeParts[1]) : start;

  if (!start || !end) return [];

  const values: (string | number)[] = [];

  for (let r = start.row; r <= end.row; r++) {
    for (let c = start.col; c <= end.col; c++) {
      const val = sheet.data[r]?.[c];
      values.push(val == null ? '' : val as string | number);
    }
  }

  return values;
}

function parseCellAddr(addr: string): { row: number; col: number } | null {
  const m = addr.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: parseInt(m[2], 10) - 1, col: col - 1 };
}
