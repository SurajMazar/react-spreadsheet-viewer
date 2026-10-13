import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { extractChartOverlays } from '../chartExtractor';
import type { SheetData } from '../../types';

/** A minimal .xlsx zip holding one sheet with one bar chart per `valRefs` entry. */
function chartWorkbook(valRefs: string[]): ArrayBuffer {
  const u8 = (s: string) => new Uint8Array(strToU8(s));
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': u8('<workbook><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': u8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml': u8('<worksheet><sheetData/><drawing r:id="rId1"/></worksheet>'),
    'xl/worksheets/_rels/sheet1.xml.rels': u8('<Relationships><Relationship Id="rId1" Target="../drawings/drawing1.xml"/></Relationships>'),
  };
  const anchors = valRefs
    .map(
      (_, i) =>
        `<xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
        `<xdr:ext cx="952500" cy="952500"/><c:chart r:id="rId${i + 1}"/></xdr:twoCellAnchor>`,
    )
    .join('');
  files['xl/drawings/drawing1.xml'] = u8(`<xdr:wsDr>${anchors}</xdr:wsDr>`);
  files['xl/drawings/_rels/drawing1.xml.rels'] = u8(
    `<Relationships>${valRefs
      .map((_, i) => `<Relationship Id="rId${i + 1}" Target="../charts/chart${i + 1}.xml"/>`)
      .join('')}</Relationships>`,
  );
  valRefs.forEach((ref, i) => {
    files[`xl/charts/chart${i + 1}.xml`] = u8(
      `<c:chartSpace><c:barChart><c:ser><c:tx><c:v>S</c:v></c:tx><c:val><c:numRef><c:f>${ref}</c:f></c:numRef></c:val></c:ser></c:barChart></c:chartSpace>`,
    );
  });
  const zipped = zipSync(files);
  return zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;
}

const sheet: SheetData = {
  data: [['1'], ['2'], ['3']],
  rows: 3,
  cols: 1,
  merges: [],
  colWidths: [],
};

describe('extractChartOverlays — reference bounds', () => {
  it('resolves a normal reference unchanged, blanks past the data included', () => {
    const out = extractChartOverlays(chartWorkbook(['Sheet1!$A$1:$A$5']), { Sheet1: sheet }, ['Sheet1']);
    expect(out.Sheet1[0].series[0].values).toEqual([1, 2, 3, 0, 0]);
  });

  it('reads a grid-sized reference no further than the sheet extent', () => {
    const start = Date.now();
    const out = extractChartOverlays(chartWorkbook(['Sheet1!$A$1:$XFD$1048576']), { Sheet1: sheet }, ['Sheet1']);
    expect(out.Sheet1[0].series[0].values).toEqual([1, 2, 3]);
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('shares one cell budget across every chart', () => {
    // Each reference fits the budget of 4 on its own; together they do not
    const out = extractChartOverlays(
      chartWorkbook(['Sheet1!$A$1:$A$3', 'Sheet1!$A$1:$A$3']),
      { Sheet1: sheet },
      ['Sheet1'],
      4,
    );
    expect(out.Sheet1).toHaveLength(1);
  });
});
