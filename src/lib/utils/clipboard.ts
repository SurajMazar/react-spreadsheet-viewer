import type { CellValue, SheetData, CellStyle } from '../types';
import type { CellRange } from '../types';

/**
 * Convert a 2D array of cell values to a TSV (tab-separated values) string.
 * Compatible with Excel and Google Sheets clipboard format.
 */
export function cellsToTsv(cells: CellValue[][]): string {
  return cells
    .map((row) =>
      row
        .map((cell) => {
          if (cell == null) return '';
          const str = String(cell);
          // Escape cells containing tabs, newlines, or quotes
          if (str.includes('\t') || str.includes('\n') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join('\t')
    )
    .join('\n');
}

/**
 * Parse a TSV string (from clipboard) into a 2D array of cell values.
 * Handles quoted fields with embedded tabs/newlines.
 */
export function tsvToCells(tsv: string): CellValue[][] {
  const rows: CellValue[][] = [];
  let currentRow: CellValue[] = [];
  let currentCell = '';
  let inQuotes = false;
  let i = 0;

  while (i < tsv.length) {
    const ch = tsv[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < tsv.length && tsv[i + 1] === '"') {
          // Escaped quote
          currentCell += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        currentCell += ch;
        i++;
      }
    } else {
      if (ch === '"' && currentCell === '') {
        inQuotes = true;
        i++;
      } else if (ch === '\t') {
        currentRow.push(parseValue(currentCell));
        currentCell = '';
        i++;
      } else if (ch === '\r' || ch === '\n') {
        currentRow.push(parseValue(currentCell));
        currentCell = '';
        rows.push(currentRow);
        currentRow = [];
        // Handle \r\n as a single line break
        if (ch === '\r' && i + 1 < tsv.length && tsv[i + 1] === '\n') {
          i++;
        }
        i++;
      } else {
        currentCell += ch;
        i++;
      }
    }
  }

  // Push the last cell and row
  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(parseValue(currentCell));
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Try to parse a string value into its native type (number, boolean, or string).
 */
function parseValue(str: string): CellValue {
  if (str === '') return '';
  const num = Number(str);
  if (!isNaN(num) && str.trim() !== '') return num;
  if (str.toLowerCase() === 'true') return true;
  if (str.toLowerCase() === 'false') return false;
  return str;
}

/**
 * Extract a 2D array of cell values for a given range from sheet data.
 */
export function extractCellsFromRange(range: CellRange, sheetData: SheetData): CellValue[][] {
  const result: CellValue[][] = [];
  for (let row = range.startRow; row <= range.endRow; row++) {
    const rowData: CellValue[] = [];
    for (let col = range.startCol; col <= range.endCol; col++) {
      rowData.push(sheetData.data[row]?.[col] ?? null);
    }
    result.push(rowData);
  }
  return result;
}

/**
 * Extract a 2D array of cell styles for a given range from sheet data.
 * Returns undefined entries where no style exists.
 */
export function extractStylesFromRange(range: CellRange, sheetData: SheetData): (CellStyle | undefined)[][] {
  const result: (CellStyle | undefined)[][] = [];
  for (let row = range.startRow; row <= range.endRow; row++) {
    const rowStyles: (CellStyle | undefined)[] = [];
    for (let col = range.startCol; col <= range.endCol; col++) {
      rowStyles.push(sheetData.styles?.[`${row},${col}`]);
    }
    result.push(rowStyles);
  }
  return result;
}

// ============================================================
// HTML Serialization (for style-preserving clipboard)
// ============================================================

/**
 * Escape text for safe inclusion in HTML.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build an inline CSS style string from a CellStyle object.
 */
function cellStyleToInlineCss(style: CellStyle): string {
  const parts: string[] = [];
  if (style.bgColor) parts.push(`background-color:${style.bgColor}`);
  if (style.fontColor) parts.push(`color:${style.fontColor}`);
  if (style.bold) parts.push('font-weight:bold');
  if (style.italic) parts.push('font-style:italic');
  if (style.fontSize) parts.push(`font-size:${style.fontSize}pt`);
  if (style.textAlign) parts.push(`text-align:${style.textAlign}`);
  return parts.join(';');
}

/**
 * Convert a 2D array of cell values + optional styles into an HTML <table> string.
 * Each <td> carries inline styles matching the CellStyle properties.
 */
export function cellsToHtml(
  cells: CellValue[][],
  styles?: (CellStyle | undefined)[][],
): string {
  let html = '<table>';
  for (let r = 0; r < cells.length; r++) {
    html += '<tr>';
    for (let c = 0; c < cells[r].length; c++) {
      const val = cells[r][c];
      const text = val != null ? escapeHtml(String(val)) : '';
      const style = styles?.[r]?.[c];
      const css = style ? cellStyleToInlineCss(style) : '';
      if (css) {
        html += `<td style="${css}">${text}</td>`;
      } else {
        html += `<td>${text}</td>`;
      }
    }
    html += '</tr>';
  }
  html += '</table>';
  return html;
}

/**
 * Parse inline CSS string into a CellStyle object.
 */
function inlineCssToCellStyle(css: string): CellStyle | undefined {
  if (!css) return undefined;
  const style: CellStyle = {};
  const props = css.split(';').filter(Boolean);
  for (const prop of props) {
    const colonIdx = prop.indexOf(':');
    if (colonIdx === -1) continue;
    const key = prop.slice(0, colonIdx).trim().toLowerCase();
    const value = prop.slice(colonIdx + 1).trim();
    switch (key) {
      case 'background-color':
        style.bgColor = value;
        break;
      case 'color':
        style.fontColor = value;
        break;
      case 'font-weight':
        if (value === 'bold' || value === '700') style.bold = true;
        break;
      case 'font-style':
        if (value === 'italic') style.italic = true;
        break;
      case 'font-size': {
        const num = parseFloat(value);
        if (!isNaN(num)) style.fontSize = num;
        break;
      }
      case 'text-align':
        if (value === 'left' || value === 'center' || value === 'right') {
          style.textAlign = value;
        }
        break;
    }
  }
  // Only return if at least one property was extracted
  if (Object.keys(style).length === 0) return undefined;
  return style;
}

/**
 * Parse an HTML table string (from clipboard) into cell values and styles.
 * Gracefully handles malformed HTML by falling back to empty results.
 */
export function htmlToCells(html: string): { values: CellValue[][]; styles: (CellStyle | undefined)[][] } {
  const values: CellValue[][] = [];
  const styles: (CellStyle | undefined)[][] = [];

  // Extract content inside <table>...</table>
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return { values, styles };

  const tableContent = tableMatch[1];

  // Extract rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
    const rowContent = rowMatch[1];
    const rowValues: CellValue[] = [];
    const rowStyles: (CellStyle | undefined)[] = [];

    // Extract cells (both <td> and <th>)
    const cellRegex = /<t[dh][^>]*?(?:\s+style="([^"]*)")?[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const inlineStyle = cellMatch[1] || '';
      let textContent = cellMatch[2];
      // Strip inner HTML tags and decode entities
      textContent = textContent.replace(/<[^>]*>/g, '');
      textContent = decodeHtmlEntities(textContent);
      rowValues.push(parseValue(textContent));
      rowStyles.push(inlineCssToCellStyle(inlineStyle));
    }

    if (rowValues.length > 0) {
      values.push(rowValues);
      styles.push(rowStyles);
    }
  }

  return { values, styles };
}

/**
 * Decode basic HTML entities.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// ============================================================
// Clipboard I/O (with style support)
// ============================================================

/**
 * Copy a 2D array of cell values + styles to the system clipboard.
 * Writes both text/html (with inline styles) and text/plain (TSV) formats.
 */
export async function copyRangeToClipboard(
  cells: CellValue[][],
  styles?: (CellStyle | undefined)[][],
): Promise<void> {
  const tsv = cellsToTsv(cells);
  const html = cellsToHtml(cells, styles);

  try {
    // Try the modern ClipboardItem API (supports multiple formats)
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
      const htmlBlob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([tsv], { type: 'text/plain' });
      const item = new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob,
      });
      await navigator.clipboard.write([item]);
      return;
    }
  } catch {
    // Fall through to text-only fallback
  }

  // Fallback: write TSV only
  try {
    await navigator.clipboard.writeText(tsv);
  } catch {
    // Fallback for older browsers or restricted contexts
    const textarea = document.createElement('textarea');
    textarea.value = tsv;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

/**
 * Read data from the system clipboard, preferring HTML (with styles) over plain TSV.
 * Returns both cell values and styles (styles may be undefined if only TSV was available).
 */
export async function pasteFromClipboard(): Promise<{
  values: CellValue[][];
  styles?: (CellStyle | undefined)[][];
} | null> {
  try {
    // Try reading HTML format first via ClipboardItem API
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes('text/html')) {
          const htmlBlob = await item.getType('text/html');
          const html = await htmlBlob.text();
          const parsed = htmlToCells(html);
          if (parsed.values.length > 0) {
            return { values: parsed.values, styles: parsed.styles };
          }
        }
      }
    }
  } catch {
    // Fall through to text-only read
  }

  // Fallback: read plain text as TSV
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return null;
    return { values: tsvToCells(text) };
  } catch {
    return null;
  }
}
