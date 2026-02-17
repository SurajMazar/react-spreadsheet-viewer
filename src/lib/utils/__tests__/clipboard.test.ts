import { describe, it, expect } from 'vitest';
import {
  cellsToTsv,
  tsvToCells,
  extractCellsFromRange,
  extractStylesFromRange,
  cellsToHtml,
  htmlToCells,
} from '../clipboard';
import type { SheetData, CellStyle } from '../../types';

// =============================================
// cellsToTsv
// =============================================
describe('cellsToTsv', () => {
  it('converts a simple 2D array to TSV', () => {
    const cells = [
      ['Name', 'Age', 'City'],
      ['Alice', 30, 'NYC'],
      ['Bob', 25, 'SF'],
    ];
    expect(cellsToTsv(cells)).toBe('Name\tAge\tCity\nAlice\t30\tNYC\nBob\t25\tSF');
  });

  it('handles null and undefined values', () => {
    const cells = [['hello', null, undefined, '']];
    expect(cellsToTsv(cells)).toBe('hello\t\t\t');
  });

  it('escapes cells containing tabs', () => {
    const cells = [['has\ttab']];
    expect(cellsToTsv(cells)).toBe('"has\ttab"');
  });

  it('escapes cells containing newlines', () => {
    const cells = [['line1\nline2']];
    expect(cellsToTsv(cells)).toBe('"line1\nline2"');
  });

  it('escapes cells containing quotes', () => {
    const cells = [['say "hello"']];
    expect(cellsToTsv(cells)).toBe('"say ""hello"""');
  });

  it('handles boolean values', () => {
    const cells = [[true, false]];
    expect(cellsToTsv(cells)).toBe('true\tfalse');
  });

  it('handles empty array', () => {
    expect(cellsToTsv([])).toBe('');
  });
});

// =============================================
// tsvToCells
// =============================================
describe('tsvToCells', () => {
  it('parses a simple TSV string', () => {
    const tsv = 'Name\tAge\tCity\nAlice\t30\tNYC';
    const result = tsvToCells(tsv);
    expect(result).toEqual([
      ['Name', 'Age', 'City'],
      ['Alice', 30, 'NYC'],
    ]);
  });

  it('handles empty string', () => {
    expect(tsvToCells('')).toEqual([]);
  });

  it('handles single cell', () => {
    expect(tsvToCells('hello')).toEqual([['hello']]);
  });

  it('parses numbers and booleans', () => {
    const tsv = '42\t3.14\ttrue\tfalse\thello';
    const result = tsvToCells(tsv);
    expect(result).toEqual([[42, 3.14, true, false, 'hello']]);
  });

  it('handles quoted fields with embedded tabs', () => {
    const tsv = '"has\ttab"\tnormal';
    const result = tsvToCells(tsv);
    expect(result).toEqual([['has\ttab', 'normal']]);
  });

  it('handles quoted fields with embedded newlines', () => {
    const tsv = '"line1\nline2"\tnext';
    const result = tsvToCells(tsv);
    expect(result).toEqual([['line1\nline2', 'next']]);
  });

  it('handles escaped quotes in quoted fields', () => {
    const tsv = '"say ""hello"""\tworld';
    const result = tsvToCells(tsv);
    expect(result).toEqual([['say "hello"', 'world']]);
  });

  it('handles \\r\\n line endings (Windows)', () => {
    const tsv = 'A\tB\r\nC\tD';
    const result = tsvToCells(tsv);
    expect(result).toEqual([
      ['A', 'B'],
      ['C', 'D'],
    ]);
  });

  it('handles \\r line endings (old Mac)', () => {
    const tsv = 'A\tB\rC\tD';
    const result = tsvToCells(tsv);
    expect(result).toEqual([
      ['A', 'B'],
      ['C', 'D'],
    ]);
  });

  it('roundtrips with cellsToTsv', () => {
    const original = [
      ['Name', 'Age'],
      ['Alice', 30],
      ['Bob', 25],
    ];
    const tsv = cellsToTsv(original);
    const parsed = tsvToCells(tsv);
    expect(parsed).toEqual(original);
  });
});

// =============================================
// extractCellsFromRange
// =============================================
describe('extractCellsFromRange', () => {
  const sheetData: SheetData = {
    data: [
      ['A1', 'B1', 'C1'],
      ['A2', 'B2', 'C2'],
      ['A3', 'B3', 'C3'],
    ],
    rows: 3,
    cols: 3,
    merges: [],
    colWidths: [100, 100, 100],
  };

  it('extracts a single cell', () => {
    const result = extractCellsFromRange(
      { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      sheetData
    );
    expect(result).toEqual([['A1']]);
  });

  it('extracts a rectangular range', () => {
    const result = extractCellsFromRange(
      { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
      sheetData
    );
    expect(result).toEqual([
      ['A1', 'B1'],
      ['A2', 'B2'],
    ]);
  });

  it('extracts a full row', () => {
    const result = extractCellsFromRange(
      { startRow: 2, startCol: 0, endRow: 2, endCol: 2 },
      sheetData
    );
    expect(result).toEqual([['A3', 'B3', 'C3']]);
  });

  it('returns null for out-of-bounds cells', () => {
    const result = extractCellsFromRange(
      { startRow: 2, startCol: 2, endRow: 3, endCol: 3 },
      sheetData
    );
    expect(result).toEqual([
      ['C3', null],
      [null, null],
    ]);
  });
});

// =============================================
// extractStylesFromRange
// =============================================
describe('extractStylesFromRange', () => {
  const styledSheet: SheetData = {
    data: [
      ['A1', 'B1'],
      ['A2', 'B2'],
    ],
    rows: 2,
    cols: 2,
    merges: [],
    colWidths: [100, 100],
    styles: {
      '0,0': { bgColor: '#ff0000', bold: true },
      '1,1': { fontColor: '#00ff00', italic: true },
    },
  };

  it('extracts styles for a range', () => {
    const result = extractStylesFromRange(
      { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
      styledSheet
    );
    expect(result[0][0]).toEqual({ bgColor: '#ff0000', bold: true });
    expect(result[0][1]).toBeUndefined();
    expect(result[1][0]).toBeUndefined();
    expect(result[1][1]).toEqual({ fontColor: '#00ff00', italic: true });
  });

  it('returns all undefined when no styles on sheet', () => {
    const noStyleSheet: SheetData = {
      data: [['A1']],
      rows: 1,
      cols: 1,
      merges: [],
      colWidths: [100],
    };
    const result = extractStylesFromRange(
      { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      noStyleSheet
    );
    expect(result).toEqual([[undefined]]);
  });

  it('extracts a single styled cell', () => {
    const result = extractStylesFromRange(
      { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      styledSheet
    );
    expect(result).toEqual([[{ bgColor: '#ff0000', bold: true }]]);
  });
});

// =============================================
// cellsToHtml
// =============================================
describe('cellsToHtml', () => {
  it('converts a 2D array to an HTML table', () => {
    const cells = [['Hello', 'World']];
    const html = cellsToHtml(cells);
    expect(html).toBe('<table><tr><td>Hello</td><td>World</td></tr></table>');
  });

  it('multi-row, multi-column structure', () => {
    const cells = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    const html = cellsToHtml(cells);
    expect(html).toContain('<tr><td>A</td><td>B</td></tr>');
    expect(html).toContain('<tr><td>C</td><td>D</td></tr>');
  });

  it('handles null and undefined values as empty strings', () => {
    const cells = [[null, undefined, '']];
    const html = cellsToHtml(cells);
    expect(html).toBe('<table><tr><td></td><td></td><td></td></tr></table>');
  });

  it('escapes HTML entities in cell text', () => {
    const cells = [['<b>bold</b>', 'A & B', '"quoted"', "it's"]];
    const html = cellsToHtml(cells);
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(html).toContain('A &amp; B');
    expect(html).toContain('&quot;quoted&quot;');
    expect(html).toContain('it&#39;s');
  });

  it('includes inline styles from CellStyle array', () => {
    const cells = [['Red cell']];
    const styles: (CellStyle | undefined)[][] = [[{ bgColor: '#ff0000' }]];
    const html = cellsToHtml(cells, styles);
    expect(html).toContain('style="background-color:#ff0000"');
  });

  it('applies all style properties', () => {
    const cells = [['Styled']];
    const styles: (CellStyle | undefined)[][] = [[{
      bgColor: '#ff0000',
      fontColor: '#0000ff',
      bold: true,
      italic: true,
      fontSize: 14,
      textAlign: 'center',
    }]];
    const html = cellsToHtml(cells, styles);
    expect(html).toContain('background-color:#ff0000');
    expect(html).toContain('color:#0000ff');
    expect(html).toContain('font-weight:bold');
    expect(html).toContain('font-style:italic');
    expect(html).toContain('font-size:14pt');
    expect(html).toContain('text-align:center');
  });

  it('does not add style attribute for cells without styles', () => {
    const cells = [['A', 'B']];
    const styles: (CellStyle | undefined)[][] = [[undefined, { bold: true }]];
    const html = cellsToHtml(cells, styles);
    // First cell: no style attr
    expect(html).toMatch(/<td>A<\/td>/);
    // Second cell: has style
    expect(html).toMatch(/<td style="font-weight:bold">B<\/td>/);
  });

  it('handles empty styles array', () => {
    const cells = [['test']];
    const html = cellsToHtml(cells, []);
    expect(html).toBe('<table><tr><td>test</td></tr></table>');
  });

  it('handles mixed styled and unstyled rows', () => {
    const cells = [['A'], ['B']];
    const styles: (CellStyle | undefined)[][] = [
      [{ bgColor: '#aaa' }],
      [undefined],
    ];
    const html = cellsToHtml(cells, styles);
    expect(html).toContain('style="background-color:#aaa"');
    expect(html).toMatch(/<td>B<\/td>/);
  });
});

// =============================================
// htmlToCells
// =============================================
describe('htmlToCells', () => {
  it('parses a simple HTML table to values', () => {
    const html = '<table><tr><td>Hello</td><td>World</td></tr></table>';
    const result = htmlToCells(html);
    expect(result.values).toEqual([['Hello', 'World']]);
    expect(result.styles).toEqual([[undefined, undefined]]);
  });

  it('parses multi-row tables', () => {
    const html = '<table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>';
    const result = htmlToCells(html);
    expect(result.values).toEqual([['A', 'B'], ['C', 'D']]);
  });

  it('extracts inline styles from td elements', () => {
    const html = '<table><tr><td style="background-color:#ff0000;color:#00ff00;font-weight:bold">Styled</td></tr></table>';
    const result = htmlToCells(html);
    expect(result.values).toEqual([['Styled']]);
    expect(result.styles[0][0]).toEqual({
      bgColor: '#ff0000',
      fontColor: '#00ff00',
      bold: true,
    });
  });

  it('parses all supported CSS properties', () => {
    const css = 'background-color:#aaa;color:#bbb;font-weight:700;font-style:italic;font-size:16pt;text-align:right';
    const html = `<table><tr><td style="${css}">X</td></tr></table>`;
    const result = htmlToCells(html);
    expect(result.styles[0][0]).toEqual({
      bgColor: '#aaa',
      fontColor: '#bbb',
      bold: true,
      italic: true,
      fontSize: 16,
      textAlign: 'right',
    });
  });

  it('handles tables without styles (values only)', () => {
    const html = '<table><tr><td>A</td><td>B</td></tr></table>';
    const result = htmlToCells(html);
    expect(result.styles).toEqual([[undefined, undefined]]);
  });

  it('handles <th> elements the same as <td>', () => {
    const html = '<table><tr><th style="font-weight:bold">Header</th></tr><tr><td>Data</td></tr></table>';
    const result = htmlToCells(html);
    expect(result.values).toEqual([['Header'], ['Data']]);
    expect(result.styles[0][0]).toEqual({ bold: true });
  });

  it('returns empty arrays for malformed HTML (no table)', () => {
    const result = htmlToCells('<div>not a table</div>');
    expect(result.values).toEqual([]);
    expect(result.styles).toEqual([]);
  });

  it('returns empty arrays for empty table', () => {
    const result = htmlToCells('<table></table>');
    expect(result.values).toEqual([]);
    expect(result.styles).toEqual([]);
  });

  it('decodes HTML entities', () => {
    const html = '<table><tr><td>&lt;b&gt;bold&lt;/b&gt;</td><td>A &amp; B</td></tr></table>';
    const result = htmlToCells(html);
    expect(result.values).toEqual([['<b>bold</b>', 'A & B']]);
  });

  it('strips inner HTML tags from cell content', () => {
    const html = '<table><tr><td><span>text</span></td></tr></table>';
    const result = htmlToCells(html);
    expect(result.values).toEqual([['text']]);
  });

  it('parses numeric values from HTML', () => {
    const html = '<table><tr><td>42</td><td>3.14</td><td>text</td></tr></table>';
    const result = htmlToCells(html);
    expect(result.values).toEqual([[42, 3.14, 'text']]);
  });

  it('parses boolean values from HTML', () => {
    const html = '<table><tr><td>true</td><td>false</td></tr></table>';
    const result = htmlToCells(html);
    expect(result.values).toEqual([[true, false]]);
  });

  it('handles cells with only style, no text', () => {
    const html = '<table><tr><td style="background-color:#fff"></td></tr></table>';
    const result = htmlToCells(html);
    expect(result.values).toEqual([['']]);
    expect(result.styles[0][0]).toEqual({ bgColor: '#fff' });
  });

  it('handles table with extra attributes', () => {
    const html = '<table class="foo" border="1"><tr><td class="bar">val</td></tr></table>';
    const result = htmlToCells(html);
    expect(result.values).toEqual([['val']]);
  });

  it('ignores unsupported CSS properties', () => {
    const html = '<table><tr><td style="border:1px solid red;padding:4px;background-color:#f00">X</td></tr></table>';
    const result = htmlToCells(html);
    expect(result.styles[0][0]).toEqual({ bgColor: '#f00' });
  });
});

// =============================================
// Roundtrip: cellsToHtml → htmlToCells
// =============================================
describe('HTML roundtrip', () => {
  it('values roundtrip through HTML', () => {
    const cells = [
      ['Name', 'Age'],
      ['Alice', 30],
    ];
    const html = cellsToHtml(cells);
    const parsed = htmlToCells(html);
    expect(parsed.values).toEqual(cells);
  });

  it('styles roundtrip through HTML', () => {
    const cells = [['Styled']];
    const styles: (CellStyle | undefined)[][] = [[{
      bgColor: '#ff0000',
      fontColor: '#0000ff',
      bold: true,
      italic: true,
      fontSize: 12,
      textAlign: 'center',
    }]];
    const html = cellsToHtml(cells, styles);
    const parsed = htmlToCells(html);
    expect(parsed.values).toEqual(cells);
    expect(parsed.styles[0][0]).toEqual(styles[0][0]);
  });

  it('mixed styled and unstyled cells roundtrip', () => {
    const cells = [['A', 'B', 'C']];
    const styles: (CellStyle | undefined)[][] = [
      [{ bgColor: '#f00' }, undefined, { bold: true }],
    ];
    const html = cellsToHtml(cells, styles);
    const parsed = htmlToCells(html);
    expect(parsed.values).toEqual(cells);
    expect(parsed.styles[0][0]).toEqual({ bgColor: '#f00' });
    expect(parsed.styles[0][1]).toBeUndefined();
    expect(parsed.styles[0][2]).toEqual({ bold: true });
  });

  it('special characters roundtrip', () => {
    const cells = [['<tag>', 'A & B', '"quoted"']];
    const html = cellsToHtml(cells);
    const parsed = htmlToCells(html);
    expect(parsed.values).toEqual(cells);
  });
});
