/**
 * Style Extractor
 *
 * Reads cell styles (fill colors, font colors, bold, italic, alignment)
 * directly from XLSX internal XML for maximum reliability. Uses fflate
 * to decompress the zip and parses the relevant XML files:
 *   - xl/theme/theme1.xml     → theme color palette
 *   - xl/styles.xml           → fills, fonts, cellXfs arrays
 *   - xl/worksheets/sheet*.xml → per-cell style index references
 */
import { unzipSync, strFromU8 } from 'fflate';
import type { CellStyle } from '../types';

// ============================================================
// Standard indexed color palette (legacy Excel 56-color palette)
// ============================================================
const INDEXED_COLORS: string[] = [
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080',
  '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF',
  '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF',
  '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99',
  '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696',
  '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333',
];

// Default Office 2007+ theme colors (used when theme1.xml can't be parsed)
const DEFAULT_THEME: string[] = [
  'FFFFFF', // 0: lt1
  '000000', // 1: dk1
  'E7E6E6', // 2: lt2
  '44546A', // 3: dk2
  '4472C4', // 4: accent1
  'ED7D31', // 5: accent2
  'A5A5A5', // 6: accent3
  'FFC000', // 7: accent4
  '5B9BD5', // 8: accent5
  '70AD47', // 9: accent6
];

type ZipEntries = Record<string, Uint8Array>;

// ============================================================
// Color resolution
// ============================================================

interface ColorRef {
  rgb?: string;
  theme?: number;
  tint?: number;
  indexed?: number;
}

function applyTint(hexRgb: string, tint: number): string {
  const r = parseInt(hexRgb.substring(0, 2), 16);
  const g = parseInt(hexRgb.substring(2, 4), 16);
  const b = parseInt(hexRgb.substring(4, 6), 16);

  const apply = (c: number): number => {
    if (tint < 0) return Math.round(c * (1 + tint));
    return Math.round(c + (255 - c) * tint);
  };

  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const nr = clamp(apply(r));
  const ng = clamp(apply(g));
  const nb = clamp(apply(b));

  return (
    nr.toString(16).padStart(2, '0') +
    ng.toString(16).padStart(2, '0') +
    nb.toString(16).padStart(2, '0')
  );
}

function resolveColor(ref: ColorRef | undefined, theme: string[]): string | undefined {
  if (!ref) return undefined;

  // Direct RGB (may be AARRGGBB or RRGGBB)
  if (ref.rgb) {
    let hex = ref.rgb;
    if (hex.length === 8) hex = hex.substring(2); // strip alpha
    // Some writers set rgb="000000" alongside a theme ref — prefer theme in that case
    if (hex !== '000000' || ref.theme == null) {
      return `#${hex}`;
    }
  }

  // Theme color
  if (ref.theme != null) {
    const base = theme[ref.theme] ?? DEFAULT_THEME[ref.theme] ?? '000000';
    if (ref.tint != null && ref.tint !== 0) {
      return `#${applyTint(base, ref.tint)}`;
    }
    return `#${base}`;
  }

  // Indexed color
  if (ref.indexed != null && ref.indexed < INDEXED_COLORS.length) {
    return `#${INDEXED_COLORS[ref.indexed]}`;
  }

  return undefined;
}

// ============================================================
// Theme parsing
// ============================================================

function parseThemeColors(zip: ZipEntries): string[] {
  const themeFile = zip['xl/theme/theme1.xml'];
  if (!themeFile) return DEFAULT_THEME;

  try {
    const xml = strFromU8(themeFile);

    // <a:clrScheme> order: dk1, lt1, dk2, lt2, accent1..accent6
    const colorNames = [
      'dk1', 'lt1', 'dk2', 'lt2',
      'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6',
    ];
    const parsed: string[] = [];

    for (const name of colorNames) {
      // Match both <a:srgbClr val="..."/> and <a:sysClr ... lastClr="..."/>
      const re = new RegExp(
        `<a:${name}>[\\s\\S]*?(?:<a:srgbClr\\s+val="([A-Fa-f0-9]{6})"[^/]*/?>|<a:sysClr[^>]*lastClr="([A-Fa-f0-9]{6})"[^/]*/?>)[\\s\\S]*?</a:${name}>`
      );
      const m = xml.match(re);
      parsed.push(((m?.[1] ?? m?.[2]) ?? (DEFAULT_THEME[parsed.length] ?? '000000')).toUpperCase());
    }

    // Remap: clrScheme order dk1,lt1,dk2,lt2 → theme index order lt1,dk1,lt2,dk2
    return [
      parsed[1], // 0: lt1
      parsed[0], // 1: dk1
      parsed[3], // 2: lt2
      parsed[2], // 3: dk2
      ...parsed.slice(4),
    ];
  } catch {
    return DEFAULT_THEME;
  }
}

// ============================================================
// styles.xml parsing
// ============================================================

interface ParsedFill {
  patternType: string;
  fgColor?: ColorRef;
  bgColor?: ColorRef;
}

interface ParsedFont {
  bold: boolean;
  italic: boolean;
  size?: number;
  color?: ColorRef;
}

interface ParsedXf {
  fillId: number;
  fontId: number;
  applyFill: boolean;
  applyFont: boolean;
  applyAlignment: boolean;
  horizontal?: string;
}

function parseColorAttr(xml: string): ColorRef | undefined {
  if (!xml) return undefined;
  const ref: ColorRef = {};
  const rgbMatch = xml.match(/rgb="([A-Fa-f0-9]+)"/);
  if (rgbMatch) ref.rgb = rgbMatch[1];
  const themeMatch = xml.match(/theme="(\d+)"/);
  if (themeMatch) ref.theme = parseInt(themeMatch[1], 10);
  const tintMatch = xml.match(/tint="([^"]+)"/);
  if (tintMatch) ref.tint = parseFloat(tintMatch[1]);
  const indexedMatch = xml.match(/indexed="(\d+)"/);
  if (indexedMatch) ref.indexed = parseInt(indexedMatch[1], 10);
  if (ref.rgb == null && ref.theme == null && ref.indexed == null) return undefined;
  return ref;
}

function parseStylesXml(zip: ZipEntries): {
  fills: ParsedFill[];
  fonts: ParsedFont[];
  cellXfs: ParsedXf[];
} {
  const stylesFile = zip['xl/styles.xml'];
  if (!stylesFile) return { fills: [], fonts: [], cellXfs: [] };

  const xml = strFromU8(stylesFile);

  // --- Fills ---
  const fills: ParsedFill[] = [];
  const fillsBlock = xml.match(/<fills[^>]*>([\s\S]*?)<\/fills>/);
  if (fillsBlock) {
    const fillRe = /<fill>([\s\S]*?)<\/fill>/g;
    let m: RegExpExecArray | null;
    while ((m = fillRe.exec(fillsBlock[1])) !== null) {
      const inner = m[1];
      const ptMatch = inner.match(/patternType="([^"]+)"/);
      const patternType = ptMatch?.[1] ?? 'none';

      let fgColor: ColorRef | undefined;
      let bgColor: ColorRef | undefined;
      const fgMatch = inner.match(/<fgColor\s+([^/]*?)\/?\s*>/);
      if (fgMatch) fgColor = parseColorAttr(fgMatch[1]);
      const bgMatch = inner.match(/<bgColor\s+([^/]*?)\/?\s*>/);
      if (bgMatch) bgColor = parseColorAttr(bgMatch[1]);

      fills.push({ patternType, fgColor, bgColor });
    }
  }

  // --- Fonts ---
  const fonts: ParsedFont[] = [];
  const fontsBlock = xml.match(/<fonts[^>]*>([\s\S]*?)<\/fonts>/);
  if (fontsBlock) {
    const fontRe = /<font[^>]*>([\s\S]*?)<\/font>/g;
    let m: RegExpExecArray | null;
    while ((m = fontRe.exec(fontsBlock[1])) !== null) {
      const inner = m[1];
      // \b ensures we don't match <bgColor>, <border>, etc.
      const bold = /<b\b/.test(inner);
      const italic = /<i\b/.test(inner);
      const szMatch = inner.match(/<sz\s+val="([^"]+)"/);
      const size = szMatch ? parseFloat(szMatch[1]) : undefined;
      const colorMatch = inner.match(/<color\s+([^/]*?)\/?\s*>/);
      const color = colorMatch ? parseColorAttr(colorMatch[1]) : undefined;
      fonts.push({ bold, italic, size, color });
    }
  }

  // --- cellXfs ---
  const cellXfs: ParsedXf[] = [];
  const xfsBlock = xml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/);
  if (xfsBlock) {
    const xfRe = /<xf\s+([\s\S]*?)\/?\s*>/g;
    let m: RegExpExecArray | null;
    while ((m = xfRe.exec(xfsBlock[1])) !== null) {
      const attrs = m[1];
      // Check if this xf has an inner <alignment> element
      const fillId = parseInt(attrs.match(/fillId="(\d+)"/)?.[1] ?? '0', 10);
      const fontId = parseInt(attrs.match(/fontId="(\d+)"/)?.[1] ?? '0', 10);
      const applyFill = attrs.includes('applyFill="1"') || attrs.includes('applyFill="true"') || fillId > 0;
      const applyFont = attrs.includes('applyFont="1"') || attrs.includes('applyFont="true"') || fontId > 0;
      const applyAlignment = attrs.includes('applyAlignment="1"') || attrs.includes('applyAlignment="true"');

      let horizontal: string | undefined;
      // Look for <alignment> inside the <xf>...</xf> block
      const xfEnd = xfsBlock[1].indexOf('</xf>', m.index! + m[0].length);
      if (xfEnd > -1) {
        const xfInner = xfsBlock[1].substring(m.index!, xfEnd);
        const alignMatch = xfInner.match(/<alignment[^>]*horizontal="([^"]+)"/);
        if (alignMatch) horizontal = alignMatch[1];
      }

      cellXfs.push({ fillId, fontId, applyFill, applyFont, applyAlignment, horizontal });
    }
  }

  return { fills, fonts, cellXfs };
}

// ============================================================
// Sheet file mapping
// ============================================================

function getSheetFileMap(zip: ZipEntries, sheetNames: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  // Try to read workbook.xml.rels for proper mapping
  const relsFile = zip['xl/_rels/workbook.xml.rels'];
  const wbFile = zip['xl/workbook.xml'];

  if (relsFile && wbFile) {
    const relsXml = strFromU8(relsFile);
    const wbXml = strFromU8(wbFile);

    // Build rId → target map
    const relMap = new Map<string, string>();
    const relRe = /<Relationship\s+[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?\s*>/g;
    let m: RegExpExecArray | null;
    while ((m = relRe.exec(relsXml)) !== null) {
      relMap.set(m[1], m[2]);
    }

    // Map sheet name → rId → target
    const sheetRe = /<sheet\s+[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/?\s*>/g;
    while ((m = sheetRe.exec(wbXml)) !== null) {
      const name = m[1];
      const rId = m[2];
      const target = relMap.get(rId);
      if (target) {
        result[name] = target.startsWith('/') ? target.substring(1) : `xl/${target}`;
      }
    }
  }

  // Fallback: conventional names
  if (Object.keys(result).length === 0) {
    for (let i = 0; i < sheetNames.length; i++) {
      result[sheetNames[i]] = `xl/worksheets/sheet${i + 1}.xml`;
    }
  }

  return result;
}

// ============================================================
// Cell reference parsing (inline to avoid circular deps)
// ============================================================

function parseCellRef(ref: string): { row: number; col: number } | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  const letters = m[1];
  const rowNum = parseInt(m[2], 10) - 1; // 0-based
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  col -= 1; // 0-based
  return { row: rowNum, col };
}

// ============================================================
// Per-sheet cell style extraction
// ============================================================

function extractCellStylesFromSheet(
  sheetXml: string,
  fills: ParsedFill[],
  fonts: ParsedFont[],
  cellXfs: ParsedXf[],
  theme: string[],
): Record<string, CellStyle> {
  const styles: Record<string, CellStyle> = {};

  // Match all <c> elements that have both r and s attributes (in any order)
  const cellRe = /<c\s+[^>]*\/?>/g;
  let m: RegExpExecArray | null;

  while ((m = cellRe.exec(sheetXml)) !== null) {
    const tag = m[0];
    const rMatch = tag.match(/\br="([A-Z]+\d+)"/);
    const sMatch = tag.match(/\bs="(\d+)"/);
    if (!rMatch || !sMatch) continue;

    const cellRef = rMatch[1];
    const styleIdx = parseInt(sMatch[1], 10);

    if (styleIdx === 0) continue; // default style — skip

    const xf = cellXfs[styleIdx];
    if (!xf) continue;

    const style: CellStyle = {};
    let hasStyle = false;

    // --- Background color from fill ---
    if (xf.fillId > 0 && xf.fillId < fills.length) {
      const fill = fills[xf.fillId];
      if (fill.patternType === 'solid' && fill.fgColor) {
        const bg = resolveColor(fill.fgColor, theme);
        if (bg && bg !== '#FFFFFF' && bg !== '#ffffff') {
          style.bgColor = bg;
          hasStyle = true;
        }
      }
    }

    // --- Font properties ---
    if (xf.fontId > 0 && xf.fontId < fonts.length) {
      const font = fonts[xf.fontId];
      if (font.bold) {
        style.bold = true;
        hasStyle = true;
      }
      if (font.italic) {
        style.italic = true;
        hasStyle = true;
      }
      if (font.size && font.size !== 11) {
        style.fontSize = font.size;
        hasStyle = true;
      }
      if (font.color) {
        const fc = resolveColor(font.color, theme);
        // Only include if it's not the default black
        if (fc && fc !== '#000000') {
          style.fontColor = fc;
          hasStyle = true;
        }
      }
    }

    // --- Alignment ---
    if (xf.applyAlignment && xf.horizontal) {
      const h = xf.horizontal.toLowerCase();
      if (h === 'center' || h === 'right' || h === 'left') {
        style.textAlign = h;
        hasStyle = true;
      }
    }

    if (hasStyle) {
      const pos = parseCellRef(cellRef);
      if (pos) {
        styles[`${pos.row},${pos.col}`] = style;
      }
    }
  }

  return styles;
}

// ============================================================
// Main export
// ============================================================

/**
 * Extract cell styles from an XLSX buffer for all sheets.
 *
 * Returns a record keyed by sheet name, where each value is a
 * sparse map of cell styles keyed by "row,col".
 */
export function extractSheetStyles(
  buffer: ArrayBuffer,
  sheetNames: string[],
): Record<string, Record<string, CellStyle>> {
  const result: Record<string, Record<string, CellStyle>> = {};

  try {
    const zip = unzipSync(new Uint8Array(buffer));

    // 1. Theme colors
    const theme = parseThemeColors(zip);

    // 2. Styles
    const { fills, fonts, cellXfs } = parseStylesXml(zip);

    if (cellXfs.length === 0) return result; // no styles at all

    // 3. Sheet file mapping
    const sheetFileMap = getSheetFileMap(zip, sheetNames);

    // 4. Extract per-sheet
    for (const name of sheetNames) {
      const filePath = sheetFileMap[name];
      if (!filePath) continue;

      const sheetFile = zip[filePath];
      if (!sheetFile) continue;

      const sheetXml = strFromU8(sheetFile);
      const styles = extractCellStylesFromSheet(sheetXml, fills, fonts, cellXfs, theme);

      if (Object.keys(styles).length > 0) {
        result[name] = styles;
      }
    }
  } catch (err) {
    console.warn('Style extraction skipped:', (err as Error).message);
  }

  return result;
}
