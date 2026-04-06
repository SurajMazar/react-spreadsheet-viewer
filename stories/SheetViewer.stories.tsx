import React, { useState, useRef } from 'react';
import { SheetViewer } from '../src/lib';
import type { SheetViewerHandle, CellRange, GridLineConfig, SheetViewerTheme } from '../src/lib';

export default {
  title: 'SheetViewer',
  component: SheetViewer,
  parameters: {
    layout: 'fullscreen',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockCsvFile(content: string, fileName = 'mock.csv'): File {
  const blob = new Blob([content], { type: 'text/csv' });
  return new File([blob], fileName, { type: 'text/csv' });
}

const sampleCsv = `Name,Age,City,Score,Department
Alice,30,New York,95,Engineering
Bob,25,San Francisco,88,Marketing
Charlie,35,London,92,Engineering
Diana,28,Tokyo,97,Design
Eve,32,Paris,85,Marketing
Frank,27,Berlin,91,Engineering
Grace,29,Sydney,89,Design
Henry,31,Toronto,93,Engineering
Ivy,26,Mumbai,96,Marketing
Jack,33,Seoul,87,Design
Kate,24,Amsterdam,94,Engineering
Leo,36,Barcelona,90,Marketing`;

const largeCsv = (() => {
  const header = 'ID,Product,Category,Price,Quantity,Revenue,Region,Status';
  const rows: string[] = [header];
  const cats = ['Electronics', 'Clothing', 'Food', 'Books', 'Toys'];
  const regions = ['North', 'South', 'East', 'West'];
  const statuses = ['Active', 'Inactive', 'Pending'];
  for (let i = 1; i <= 200; i++) {
    rows.push(
      `${i},Product ${i},${cats[i % cats.length]},${(Math.random() * 100 + 1).toFixed(2)},${Math.floor(Math.random() * 500 + 1)},${(Math.random() * 5000).toFixed(2)},${regions[i % regions.length]},${statuses[i % statuses.length]}`
    );
  }
  return rows.join('\n');
})();

const infoPanel = (children: React.ReactNode) => (
  <div style={{ padding: '8px 14px', background: '#e8f0fe', borderBottom: '1px solid #d2e3fc', fontSize: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
    {children}
  </div>
);

// ─── Existing Stories ─────────────────────────────────────────────────────────

export const FromFile = {
  name: '1 · From CSV File',
  parameters: { chromatic: { delay: 2000 } },
  render: () => {
    const file = createMockCsvFile(sampleCsv, 'sample_data.csv');
    return <div style={{ height: '100vh' }}><SheetViewer source={file} /></div>;
  },
};

export const ViewMode = {
  name: '2 · View Mode (read-only)',
  parameters: { chromatic: { delay: 2000 } },
  render: () => {
    const file = createMockCsvFile(sampleCsv, 'readonly.csv');
    return <div style={{ height: '100vh' }}><SheetViewer source={file} mode="view" /></div>;
  },
};

export const EditMode = {
  name: '3 · Edit Mode',
  parameters: { chromatic: { delay: 2000 } },
  render: () => {
    const file = createMockCsvFile(sampleCsv, 'editable.csv');
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {infoPanel(<span>Double-click any cell to edit · Ctrl+Z to undo · Ctrl+Y to redo</span>)}
        <div style={{ flex: 1 }}>
          <SheetViewer
            source={file}
            mode="edit"
            onCellChange={(sheet, row, col, value) =>
              console.log(`Cell [${row},${col}] in "${sheet}" → ${value}`)
            }
          />
        </div>
      </div>
    );
  },
};

export const WithHighlight = {
  name: '4 · Range Highlight (B2:C5)',
  parameters: { chromatic: { delay: 2000 } },
  render: () => {
    const file = createMockCsvFile(sampleCsv, 'highlight.csv');
    return <div style={{ height: '100vh' }}><SheetViewer source={file} highlight="B2:C5" /></div>;
  },
};

export const WithDownload = {
  name: '5 · Download Button',
  parameters: { chromatic: { delay: 2000 } },
  render: () => {
    const file = createMockCsvFile(sampleCsv, 'downloadable.csv');
    return <div style={{ height: '100vh' }}><SheetViewer source={file} downloadable /></div>;
  },
};

export const CustomSize = {
  name: '6 · Custom Size (600×400)',
  parameters: { chromatic: { delay: 2000 } },
  render: () => {
    const file = createMockCsvFile(sampleCsv, 'sized.csv');
    return (
      <div style={{ padding: 40, background: '#f5f5f5', height: '100vh' }}>
        <SheetViewer source={file} width={600} height={400} />
      </div>
    );
  },
};

export const MultipleInstances = {
  name: '7 · Multiple Instances',
  parameters: { chromatic: { delay: 2000 } },
  render: () => {
    const file1 = createMockCsvFile(sampleCsv, 'people.csv');
    const file2 = createMockCsvFile(
      'Product,Price,Qty,Revenue\nWidget,9.99,100,999\nGadget,19.99,50,999.5\nDoohickey,4.99,200,998',
      'products.csv'
    );
    return (
      <div style={{ display: 'flex', height: '100vh', gap: 8, padding: 8 }}>
        <div style={{ flex: 1 }}><SheetViewer source={file1} height="100%" width="100%" /></div>
        <div style={{ flex: 1 }}><SheetViewer source={file2} height="100%" width="100%" /></div>
      </div>
    );
  },
};

export const ControlledSheet = {
  name: '8 · Controlled Active Sheet',
  parameters: { chromatic: { disableSnapshot: true } },
  render: () => {
    const [currentSheet, setCurrentSheet] = useState<string | undefined>(undefined);
    const file = createMockCsvFile(sampleCsv, 'controlled.csv');
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {infoPanel(<><strong>Active sheet:</strong>&nbsp;{currentSheet || '(auto)'}</>)}
        <div style={{ flex: 1 }}>
          <SheetViewer source={file} activeSheet={currentSheet} onSheetChange={setCurrentSheet} />
        </div>
      </div>
    );
  },
};

export const WithRef = {
  name: '9 · Imperative Ref Handle',
  parameters: { chromatic: { delay: 3000 } },
  render: () => {
    const ref = useRef<SheetViewerHandle>(null);
    const file = createMockCsvFile(sampleCsv, 'ref-demo.csv');
    const [info, setInfo] = useState('Click a button above to inspect the viewer');
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {infoPanel(
          <>
            <button style={btnStyle} onClick={() => setInfo(`Sheets: ${ref.current?.getSheetNames()?.join(', ')}`)}>getSheetNames()</button>
            <button style={btnStyle} onClick={() => { const d = ref.current?.getSheetData(); setInfo(`Rows: ${d?.rows}, Cols: ${d?.cols}`); }}>getSheetData()</button>
            <button style={btnStyle} onClick={() => { ref.current?.setHighlight('A1:C3'); setInfo('setHighlight("A1:C3")'); }}>Highlight A1:C3</button>
            <button style={btnStyle} onClick={() => setInfo(`getHighlight() = ${ref.current?.getHighlight() ?? 'null'}`)}>getHighlight()</button>
            <button style={btnStyle} onClick={() => { ref.current?.undo(); setInfo('undo()'); }}>undo()</button>
            <button style={btnStyle} onClick={() => { ref.current?.redo(); setInfo('redo()'); }}>redo()</button>
            <span style={{ marginLeft: 'auto', color: '#1a73e8', fontWeight: 500 }}>{info}</span>
          </>
        )}
        <div style={{ flex: 1 }}>
          <SheetViewer ref={ref} source={file} mode="edit" />
        </div>
      </div>
    );
  },
};

export const NoSource = {
  name: '10 · No Source (Empty State)',
  parameters: { chromatic: { disableSnapshot: false } },
  render: () => (
    <div style={{ padding: 40, background: '#f5f5f5', height: '100vh' }}>
      <SheetViewer height={400} width={600} />
    </div>
  ),
};

// ─── New Feature Stories ──────────────────────────────────────────────────────

export const CustomHighlightColors = {
  name: '11 · Custom Highlight Colors',
  parameters: { chromatic: { delay: 2000 } },
  render: () => {
    const [colorIdx, setColorIdx] = useState(0);
    const file = createMockCsvFile(sampleCsv, 'colors.csv');

    const colorPairs = [
      { fill: 'rgba(255, 0, 0, 0.12)', border: '#e53935', label: 'Red' },
      { fill: 'rgba(0, 200, 83, 0.15)', border: '#00c853', label: 'Green' },
      { fill: 'rgba(156, 39, 176, 0.12)', border: '#9c27b0', label: 'Purple' },
      { fill: 'rgba(255, 152, 0, 0.15)', border: '#ff9800', label: 'Orange' },
    ];
    const { fill, border, label } = colorPairs[colorIdx];

    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {infoPanel(
          <>
            <strong>highlightColor &amp; highlightBorderColor:</strong>
            {colorPairs.map((p, i) => (
              <button key={p.label} style={{ ...btnStyle, background: i === colorIdx ? p.border : undefined, color: i === colorIdx ? 'white' : undefined }} onClick={() => setColorIdx(i)}>{p.label}</button>
            ))}
            <code style={codeStyle}>fill: {fill} · border: {border}</code>
          </>
        )}
        <div style={{ flex: 1 }}>
          <SheetViewer
            source={file}
            highlight="B2:D6"
            highlightColor={fill}
            highlightBorderColor={border}
          />
        </div>
      </div>
    );
  },
};

export const SeparateSearchHighlight = {
  name: '12 · Search Highlight (separate from selection)',
  parameters: { chromatic: { disableSnapshot: true } },
  render: () => {
    const file = createMockCsvFile(sampleCsv, 'search.csv');
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {infoPanel(
          <span>Press <kbd style={kbdStyle}>Ctrl+F</kbd> to open search · Search matches use a <strong>separate</strong> yellow highlight that does not interfere with selection</span>
        )}
        <div style={{ flex: 1 }}>
          <SheetViewer
            source={file}
            highlight="A1:B3"
            searchMatchColor="rgba(255, 213, 79, 0.5)"
            searchActiveColor="rgba(255, 152, 0, 0.7)"
          />
        </div>
      </div>
    );
  },
};

export const SearchHighlightCustomColors = {
  name: '13 · Search Highlight Custom Colors',
  parameters: { chromatic: { disableSnapshot: true } },
  render: () => {
    const [scheme, setScheme] = useState<'yellow' | 'blue' | 'green'>('yellow');
    const file = createMockCsvFile(sampleCsv, 'search-colors.csv');

    const schemes = {
      yellow: { match: 'rgba(255, 213, 79, 0.45)', active: 'rgba(255, 152, 0, 0.7)' },
      blue: { match: 'rgba(26, 115, 232, 0.2)', active: 'rgba(26, 115, 232, 0.6)' },
      green: { match: 'rgba(15, 157, 88, 0.2)', active: 'rgba(15, 157, 88, 0.6)' },
    };

    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {infoPanel(
          <>
            <strong>Search color scheme:</strong>
            {(['yellow', 'blue', 'green'] as const).map((s) => (
              <button key={s} style={{ ...btnStyle, background: scheme === s ? '#1a73e8' : undefined, color: scheme === s ? 'white' : undefined }} onClick={() => setScheme(s)}>{s}</button>
            ))}
            <span style={{ color: '#5f6368' }}>Press Ctrl+F then type a name to see matches</span>
          </>
        )}
        <div style={{ flex: 1 }}>
          <SheetViewer
            source={file}
            searchMatchColor={schemes[scheme].match}
            searchActiveColor={schemes[scheme].active}
          />
        </div>
      </div>
    );
  },
};

export const GridLinesStory = {
  name: '14 · Grid Lines',
  parameters: { chromatic: { delay: 2000 } },
  render: () => {
    const [preset, setPreset] = useState<'none' | 'header' | 'table' | 'multi'>('table');
    const file = createMockCsvFile(sampleCsv, 'gridlines.csv');

    const presets: Record<string, { label: string; lines: GridLineConfig[] }> = {
      none: { label: 'None', lines: [] },
      header: {
        label: 'Header Row',
        lines: [{ range: 'A1:E1', borderColor: '#1a73e8', borderWidth: 2, borderStyle: 'solid', bgColor: '#e8f0fe' }],
      },
      table: {
        label: 'Table (A1:E12)',
        lines: [{ range: 'A1:E12', borderColor: '#5f6368', borderWidth: 1, borderStyle: 'solid' }],
      },
      multi: {
        label: 'Multi-zone',
        lines: [
          { range: 'A1:E1', borderColor: '#1a73e8', borderWidth: 2, bgColor: '#e8f0fe' },
          { range: 'A2:E12', borderColor: '#dadce0', borderWidth: 1 },
          { range: 'C1:C12', borderColor: '#ea4335', borderWidth: 1, borderStyle: 'dashed' },
        ],
      },
    };

    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {infoPanel(
          <>
            <strong>gridLines preset:</strong>
            {Object.entries(presets).map(([key, val]) => (
              <button key={key} style={{ ...btnStyle, background: preset === key ? '#1a73e8' : undefined, color: preset === key ? 'white' : undefined }} onClick={() => setPreset(key as typeof preset)}>{val.label}</button>
            ))}
          </>
        )}
        <div style={{ flex: 1 }}>
          <SheetViewer
            source={file}
            gridLines={presets[preset].lines.length > 0 ? presets[preset].lines : undefined}
          />
        </div>
      </div>
    );
  },
};

export const ShowToolbarProp = {
  name: '15 · Show/Hide Toolbar & Filename',
  parameters: { chromatic: { delay: 2000 } },
  render: () => {
    const [mode, setMode] = useState<'full' | 'noFilename' | 'noToolbar'>('full');
    const file = createMockCsvFile(sampleCsv, 'toolbar.csv');
    const desc = {
      full: 'Full toolbar: logo + filename + Charts + Download',
      noFilename: 'showFileName={false}: logo/filename hidden, buttons remain',
      noToolbar: 'showToolbar={false}: entire toolbar hidden',
    };
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {infoPanel(
          <>
            <strong>Toolbar visibility:</strong>
            {(['full', 'noFilename', 'noToolbar'] as const).map((m) => (
              <button key={m} style={{ ...btnStyle, background: mode === m ? '#1a73e8' : undefined, color: mode === m ? 'white' : undefined }} onClick={() => setMode(m)}>
                {m === 'full' ? 'Full' : m === 'noFilename' ? 'Hide Filename' : 'Hide Toolbar'}
              </button>
            ))}
            <span style={{ color: '#5f6368' }}>{desc[mode]}</span>
          </>
        )}
        <div style={{ flex: 1 }}>
          <SheetViewer
            source={file}
            showToolbar={mode !== 'noToolbar'}
            showFileName={mode !== 'noFilename'}
            downloadable
            chartable
          />
        </div>
      </div>
    );
  },
};

export const ThemePresets = {
  name: '16 · Theme Presets',
  parameters: { chromatic: { delay: 2000 } },
  render: () => {
    const [preset, setPreset] = useState<'default' | 'dark' | 'green' | 'purple'>('default');
    const file = createMockCsvFile(sampleCsv, 'themed.csv');

    const themes: Record<string, { label: string; theme?: SheetViewerTheme }> = {
      default: { label: 'Default', theme: undefined },
      dark: {
        label: 'Dark',
        theme: {
          bgColor: '#1e1e2e', surfaceColor: '#181825', borderColor: '#313244', borderLightColor: '#45475a',
          textColor: '#cdd6f4', textSecondaryColor: '#a6adc8', textMutedColor: '#6c7086',
          primaryColor: '#89b4fa', primaryLightColor: '#313244', primaryBgColor: '#1e1e2e',
          selectionColor: 'rgba(137,180,250,0.15)', selectionHoverColor: 'rgba(137,180,250,0.25)',
          headerBgColor: '#181825', headerTextColor: '#a6adc8', hoverColor: '#313244',
        },
      },
      green: {
        label: 'Forest Green',
        theme: {
          bgColor: '#f1f8f4', surfaceColor: '#e6f4ea', borderColor: '#b7dfc4',
          primaryColor: '#137333', primaryLightColor: '#b7dfc4', primaryBgColor: '#e6f4ea',
          selectionColor: 'rgba(19,115,51,0.1)', headerBgColor: '#e6f4ea', headerTextColor: '#137333',
        },
      },
      purple: {
        label: 'Purple',
        theme: {
          bgColor: '#faf5ff', surfaceColor: '#f3e8ff', borderColor: '#d8b4fe', borderLightColor: '#e9d5ff',
          primaryColor: '#7c3aed', primaryLightColor: '#ddd6fe', primaryBgColor: '#f3e8ff',
          selectionColor: 'rgba(124,58,237,0.1)', headerBgColor: '#f3e8ff', headerTextColor: '#6d28d9',
        },
      },
    };

    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {infoPanel(
          <>
            <strong>theme:</strong>
            {Object.entries(themes).map(([key, val]) => (
              <button key={key} style={{ ...btnStyle, background: preset === key ? '#1a73e8' : undefined, color: preset === key ? 'white' : undefined }} onClick={() => setPreset(key as typeof preset)}>{val.label}</button>
            ))}
          </>
        )}
        <div style={{ flex: 1 }}>
          <SheetViewer source={file} theme={themes[preset].theme} />
        </div>
      </div>
    );
  },
};

export const SelectionChangeWithCellInfo = {
  name: '17 · onSelectionChange with cellInfo',
  parameters: { chromatic: { disableSnapshot: true } },
  render: () => {
    const file = createMockCsvFile(sampleCsv, 'selection.csv');
    const [info, setInfo] = useState<{
      range: string;
      top?: number; left?: number; width?: number; height?: number;
    } | null>(null);

    const handleSelection = (ranges: CellRange[], cellInfo?: { element: HTMLElement; rect: DOMRect }) => {
      const r = ranges[0];
      if (!r) return;
      const toCol = (n: number) => { let s = ''; for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(((x - 1) % 26) + 65) + s; return s; };
      const range = r.startRow === r.endRow && r.startCol === r.endCol
        ? `${toCol(r.startCol)}${r.startRow + 1}`
        : `${toCol(r.startCol)}${r.startRow + 1}:${toCol(r.endCol)}${r.endRow + 1}`;
      setInfo(cellInfo
        ? { range, top: Math.round(cellInfo.rect.top), left: Math.round(cellInfo.rect.left), width: Math.round(cellInfo.rect.width), height: Math.round(cellInfo.rect.height) }
        : { range }
      );
    };

    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {infoPanel(
          <>
            <strong>onSelectionChange:</strong>
            {info ? (
              <span style={{ color: '#202124' }}>
                Range: <code style={codeStyle}>{info.range}</code>
                {info.top !== undefined && <>&nbsp;· rect: ({info.left}, {info.top}) {info.width}×{info.height}px</>}
              </span>
            ) : (
              <span style={{ color: '#80868b' }}>Click a cell to see range + DOM rect</span>
            )}
          </>
        )}
        <div style={{ flex: 1 }}>
          <SheetViewer source={file} onSelectionChange={handleSelection} />
        </div>
      </div>
    );
  },
};

export const HighlightableOff = {
  name: '18 · Highlights Disabled',
  parameters: { chromatic: { delay: 2000 } },
  render: () => {
    const file = createMockCsvFile(sampleCsv, 'no-highlight.csv');
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {infoPanel(<span><code style={codeStyle}>highlightable=&#123;false&#125;</code> — no visual selection or highlight indicators are shown</span>)}
        <div style={{ flex: 1 }}>
          <SheetViewer source={file} highlightable={false} highlight="B2:D5" />
        </div>
      </div>
    );
  },
};

export const LargeDataset = {
  name: '19 · Large Dataset (200 rows)',
  parameters: { chromatic: { delay: 3000 } },
  render: () => {
    const file = createMockCsvFile(largeCsv, 'large.csv');
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {infoPanel(<span>200 rows × 8 columns — virtualized rendering keeps the UI smooth</span>)}
        <div style={{ flex: 1 }}>
          <SheetViewer source={file} searchable downloadable />
        </div>
      </div>
    );
  },
};

export const AllFeaturesEnabled = {
  name: '20 · All Features Enabled',
  parameters: { chromatic: { delay: 3000 } },
  render: () => {
    const ref = useRef<SheetViewerHandle>(null);
    const file = createMockCsvFile(sampleCsv, 'all-features.csv');
    const [selInfo, setSelInfo] = useState('');

    const gridLines: GridLineConfig[] = [
      { range: 'A1:E1', borderColor: '#1a73e8', borderWidth: 2, bgColor: '#e8f0fe' },
      { range: 'A1:E12', borderColor: '#dadce0', borderWidth: 1 },
    ];

    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {infoPanel(
          <>
            <strong>All props active</strong>
            <button style={btnStyle} onClick={() => ref.current?.setHighlight('B2:D5')}>Highlight B2:D5</button>
            <button style={btnStyle} onClick={() => ref.current?.undo()}>Undo</button>
            <button style={btnStyle} onClick={() => ref.current?.redo()}>Redo</button>
            <span style={{ color: '#5f6368' }}>{selInfo || 'Click a cell'}</span>
          </>
        )}
        <div style={{ flex: 1 }}>
          <SheetViewer
            ref={ref}
            source={file}
            mode="edit"
            downloadable
            searchable
            chartable
            showToolbar
            showFileName
            highlightable
            gridLines={gridLines}
            searchMatchColor="rgba(255, 213, 79, 0.45)"
            searchActiveColor="rgba(255, 152, 0, 0.7)"
            onSelectionChange={(ranges, cellInfo) => {
              const r = ranges[0];
              if (!r) return;
              const toCol = (n: number) => { let s = ''; for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(((x - 1) % 26) + 65) + s; return s; };
              const range = r.startRow === r.endRow && r.startCol === r.endCol
                ? `${toCol(r.startCol)}${r.startRow + 1}`
                : `${toCol(r.startCol)}${r.startRow + 1}:${toCol(r.endCol)}${r.endRow + 1}`;
              setSelInfo(`Selected: ${range}${cellInfo ? ` @ (${Math.round(cellInfo.rect.left)}, ${Math.round(cellInfo.rect.top)})` : ''}`);
            }}
            onCellChange={(s, r, c, v) => console.log(`Edit: ${s}[${r},${c}]=${v}`)}
            onSheetSelect={(n) => console.log('Tab clicked:', n)}
          />
        </div>
      </div>
    );
  },
};

// ─── Style helpers ────────────────────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid #dadce0',
  borderRadius: 4,
  background: 'white',
  fontSize: 11,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const codeStyle: React.CSSProperties = {
  background: '#e8f0fe',
  color: '#1a73e8',
  padding: '1px 5px',
  borderRadius: 3,
  fontFamily: 'monospace',
  fontSize: 11,
};

const kbdStyle: React.CSSProperties = {
  background: '#f1f3f4',
  border: '1px solid #dadce0',
  borderRadius: 3,
  padding: '1px 5px',
  fontFamily: 'monospace',
  fontSize: 11,
};
