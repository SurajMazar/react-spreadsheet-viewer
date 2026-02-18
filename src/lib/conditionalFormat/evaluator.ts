import type { CellStyle, CellValue, ConditionalFormatRule, SheetData } from '../types';

/**
 * Evaluate all conditional formatting rules for a specific cell.
 * Returns an accumulated CellStyle to overlay on the cell's base style.
 * Later rules take precedence (last one wins).
 */
export function evaluateConditionalFormats(
  row: number,
  col: number,
  cellValue: CellValue,
  rules: ConditionalFormatRule[],
  sheetData: SheetData,
): CellStyle | undefined {
  let result: CellStyle | undefined;

  for (const rule of rules) {
    // Check if the cell is within the rule's range
    if (row < rule.range.startRow || row > rule.range.endRow) continue;
    if (col < rule.range.startCol || col > rule.range.endCol) continue;

    const matched = evaluateRule(rule, cellValue, row, col, sheetData);
    if (matched) {
      result = { ...(result || {}), ...matched };
    }
  }

  return result;
}

function evaluateRule(
  rule: ConditionalFormatRule,
  cellValue: CellValue,
  row: number,
  col: number,
  sheetData: SheetData,
): CellStyle | undefined {
  const numValue = toNumber(cellValue);

  switch (rule.type) {
    case 'greaterThan': {
      const threshold = toNumber(rule.values?.[0]);
      if (numValue !== null && threshold !== null && numValue > threshold) {
        return rule.style;
      }
      return undefined;
    }

    case 'lessThan': {
      const threshold = toNumber(rule.values?.[0]);
      if (numValue !== null && threshold !== null && numValue < threshold) {
        return rule.style;
      }
      return undefined;
    }

    case 'between': {
      const min = toNumber(rule.values?.[0]);
      const max = toNumber(rule.values?.[1]);
      if (numValue !== null && min !== null && max !== null && numValue >= min && numValue <= max) {
        return rule.style;
      }
      return undefined;
    }

    case 'equalTo': {
      const target = rule.values?.[0];
      if (target !== undefined && String(cellValue) === String(target)) {
        return rule.style;
      }
      return undefined;
    }

    case 'textContains': {
      const substring = String(rule.values?.[0] ?? '').toLowerCase();
      if (substring && String(cellValue ?? '').toLowerCase().includes(substring)) {
        return rule.style;
      }
      return undefined;
    }

    case 'top10': {
      const n = toNumber(rule.values?.[0]) ?? 10;
      const rangeValues = collectNumericValues(rule.range, sheetData);
      rangeValues.sort((a, b) => b - a);
      const threshold = rangeValues[Math.min(Math.floor(n) - 1, rangeValues.length - 1)];
      if (numValue !== null && threshold !== undefined && numValue >= threshold) {
        return rule.style;
      }
      return undefined;
    }

    case 'bottom10': {
      const n = toNumber(rule.values?.[0]) ?? 10;
      const rangeValues = collectNumericValues(rule.range, sheetData);
      rangeValues.sort((a, b) => a - b);
      const threshold = rangeValues[Math.min(Math.floor(n) - 1, rangeValues.length - 1)];
      if (numValue !== null && threshold !== undefined && numValue <= threshold) {
        return rule.style;
      }
      return undefined;
    }

    case 'colorScale': {
      if (!rule.colorScale || rule.colorScale.length < 2) return undefined;
      if (numValue === null) return undefined;
      const rangeValues = collectNumericValues(rule.range, sheetData);
      if (rangeValues.length === 0) return undefined;
      const minVal = Math.min(...rangeValues);
      const maxVal = Math.max(...rangeValues);
      if (minVal === maxVal) return { bgColor: rule.colorScale[0] };
      const ratio = (numValue - minVal) / (maxVal - minVal);
      const color = interpolateColor(rule.colorScale, ratio);
      return { bgColor: color };
    }

    case 'dataBar': {
      // Data bars are rendered separately in Cell; we return a bgColor hint with percentage
      // The actual bar rendering happens in the Cell component
      if (numValue === null) return undefined;
      const rangeValues = collectNumericValues(rule.range, sheetData);
      if (rangeValues.length === 0) return undefined;
      const minVal = Math.min(...rangeValues);
      const maxVal = Math.max(...rangeValues);
      if (minVal === maxVal) return undefined;
      // We encode the percentage as a custom style property approach
      // For now, return the bar color as bgColor
      return { bgColor: rule.barColor || '#4285f4' };
    }

    case 'iconSet':
      // Icon sets would require rendering; for now, map to text-based approach
      return undefined;

    default:
      return undefined;
  }
}

function toNumber(value: CellValue | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

function collectNumericValues(range: import('../types').CellRange, sheetData: SheetData): number[] {
  const values: number[] = [];
  for (let r = range.startRow; r <= range.endRow; r++) {
    for (let c = range.startCol; c <= range.endCol; c++) {
      const v = toNumber(sheetData.data[r]?.[c]);
      if (v !== null) values.push(v);
    }
  }
  return values;
}

/**
 * Interpolate between colors in a gradient.
 * @param colors Array of hex color strings (2 or 3 stops)
 * @param ratio 0..1 position in the gradient
 */
export function interpolateColor(colors: string[], ratio: number): string {
  const clampedRatio = Math.max(0, Math.min(1, ratio));

  if (colors.length === 2) {
    return blendColors(colors[0], colors[1], clampedRatio);
  }

  if (colors.length >= 3) {
    if (clampedRatio <= 0.5) {
      return blendColors(colors[0], colors[1], clampedRatio * 2);
    } else {
      return blendColors(colors[1], colors[2], (clampedRatio - 0.5) * 2);
    }
  }

  return colors[0];
}

function blendColors(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
