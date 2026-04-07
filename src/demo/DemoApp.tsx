import React, { useState, useCallback, useRef } from 'react';
import { SheetViewer } from '../lib';
import type {
  SheetViewerMode,
  SheetViewerSource,
  SheetViewerHandle,
  CellRange,
  GridLineConfig,
  SheetViewerTheme,
} from '../lib';
import './demo.css';

const ACCEPTED_TYPES = '.xlsx,.xls,.csv';

// ─── Preset Themes ─────────────────────────────────────────────────────────────

const THEME_PRESETS: Record<string, { label: string; theme: SheetViewerTheme }> = {
  default: { label: 'Default (Google Sheets)', theme: {} },
  dark: {
    label: 'Dark',
    theme: {
      bgColor: '#1e1e2e',
      surfaceColor: '#181825',
      borderColor: '#313244',
      borderLightColor: '#45475a',
      textColor: '#cdd6f4',
      textSecondaryColor: '#a6adc8',
      textMutedColor: '#6c7086',
      primaryColor: '#89b4fa',
      primaryLightColor: '#313244',
      primaryBgColor: '#1e1e2e',
      selectionColor: 'rgba(137,180,250,0.15)',
      selectionHoverColor: 'rgba(137,180,250,0.25)',
      headerBgColor: '#181825',
      headerTextColor: '#a6adc8',
      hoverColor: '#313244',
    },
  },
  green: {
    label: 'Forest Green',
    theme: {
      bgColor: '#f1f8f4',
      surfaceColor: '#e6f4ea',
      borderColor: '#b7dfc4',
      primaryColor: '#137333',
      primaryLightColor: '#b7dfc4',
      primaryBgColor: '#e6f4ea',
      selectionColor: 'rgba(19,115,51,0.1)',
      selectionHoverColor: 'rgba(19,115,51,0.18)',
      headerBgColor: '#e6f4ea',
      headerTextColor: '#137333',
    },
  },
  purple: {
    label: 'Royal Purple',
    theme: {
      bgColor: '#faf5ff',
      surfaceColor: '#f3e8ff',
      borderColor: '#d8b4fe',
      borderLightColor: '#e9d5ff',
      primaryColor: '#7c3aed',
      primaryLightColor: '#ddd6fe',
      primaryBgColor: '#f3e8ff',
      selectionColor: 'rgba(124,58,237,0.1)',
      selectionHoverColor: 'rgba(124,58,237,0.19)',
      headerBgColor: '#f3e8ff',
      headerTextColor: '#6d28d9',
    },
  },
  warm: {
    label: 'Warm Amber',
    theme: {
      bgColor: '#fffbeb',
      surfaceColor: '#fef3c7',
      borderColor: '#fde68a',
      primaryColor: '#d97706',
      primaryLightColor: '#fde68a',
      primaryBgColor: '#fef3c7',
      selectionColor: 'rgba(217,119,6,0.1)',
      selectionHoverColor: 'rgba(217,119,6,0.18)',
      headerBgColor: '#fef3c7',
      headerTextColor: '#92400e',
    },
  },
};

// ─── Preset Grid Line Sets ──────────────────────────────────────────────────────

const GRID_LINE_PRESETS: Record<string, { label: string; lines: GridLineConfig[] }> = {
  none: { label: 'None', lines: [] },
  headerRow: {
    label: 'Header Row (A1:Z1)',
    lines: [{ range: 'A1:Z1', borderColor: '#1a73e8', borderWidth: 2, borderStyle: 'solid', bgColor: '#e8f0fe' }],
  },
  table: {
    label: 'Data Table (A1:E10)',
    lines: [{ range: 'A1:E10', borderColor: '#5f6368', borderWidth: 1, borderStyle: 'solid' }],
  },
  dashed: {
    label: 'Dashed Zone (B2:D8)',
    lines: [{ range: 'B2:D8', borderColor: '#ea4335', borderWidth: 1, borderStyle: 'dashed' }],
  },
  multizone: {
    label: 'Multi-zone',
    lines: [
      { range: 'A1:E1', borderColor: '#1a73e8', borderWidth: 2, borderStyle: 'solid', bgColor: '#e8f0fe' },
      { range: 'A2:E10', borderColor: '#dadce0', borderWidth: 1, borderStyle: 'solid' },
    ],
  },
};

// ─── Selection Info ─────────────────────────────────────────────────────────────

interface SelectionInfo {
  ranges: CellRange[];
  rangeStr: string;
  cellRect?: DOMRect;
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function DemoApp() {
  // File state
  const [source, setSource] = useState<SheetViewerSource | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Viewer controls
  const [mode, setMode] = useState<SheetViewerMode>('view');
  const [highlight, setHighlight] = useState('');
  const [highlightColor, setHighlightColor] = useState('');
  const [highlightBorderColor, setHighlightBorderColor] = useState('');
  const [highlightable, setHighlightable] = useState(true);
  const [downloadable, setDownloadable] = useState(true);
  const [searchable, setSearchable] = useState(true);
  const [chartable, setChartable] = useState(true);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showFileName, setShowFileName] = useState(true);

  // Search highlight colors
  const [searchMatchColor, setSearchMatchColor] = useState('');
  const [searchActiveColor, setSearchActiveColor] = useState('');

  // Theme
  const [themePreset, setThemePreset] = useState('default');

  // Grid lines
  const [gridLinePreset, setGridLinePreset] = useState('none');
  const [customGridRange, setCustomGridRange] = useState('');
  const [customGridColor, setCustomGridColor] = useState('#1a73e8');

  // Sheet control
  const [activeSheet, setActiveSheet] = useState<string | undefined>(undefined);

  // Selection info
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);

  // Sidebar panel
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'display' | 'colors' | 'grid' | 'callbacks'>('display');

  // Ref
  const viewerRef = useRef<SheetViewerHandle>(null);

  // ─── Computed props ───────────────────────────────────────────────────────────

  const currentTheme = THEME_PRESETS[themePreset]?.theme ?? {};

  const gridLines: GridLineConfig[] = (() => {
    const preset = GRID_LINE_PRESETS[gridLinePreset]?.lines ?? [];
    if (customGridRange.trim()) {
      return [...preset, { range: customGridRange.trim(), borderColor: customGridColor, borderWidth: 1, borderStyle: 'solid' }];
    }
    return preset;
  })();

  // ─── Event handlers ───────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File | undefined) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      alert('Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
      return;
    }
    setSource(file);
    setActiveSheet(undefined);
    setHighlight('');
    setSelectionInfo(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => { setIsDragging(false); }, []);
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = '';
  }, [handleFile]);

  const handleSheetChange = useCallback((name: string) => { setActiveSheet(name); }, []);

  const handleCellChange = useCallback((sheet: string, row: number, col: number, value: unknown) => {
    console.log(`Cell changed: ${sheet} [${row},${col}] = ${value}`);
  }, []);

  const handleSelectionChange = useCallback((ranges: CellRange[], cellInfo?: { element: HTMLElement; rect: DOMRect }) => {
    const first = ranges[0];
    if (!first) {
      setSelectionInfo(null);
      return;
    }
    const r = first;
    const toLetter = (n: number) => {
      let s = '';
      for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(((x - 1) % 26) + 65) + s;
      return s;
    };
    const rangeStr = r.startRow === r.endRow && r.startCol === r.endCol
      ? `${toCol(r.startCol)}${r.startRow + 1}`
      : `${toCol(r.startCol)}${r.startRow + 1}:${toCol(r.endCol)}${r.endRow + 1}`;

    setSelectionInfo({ ranges, rangeStr, cellRect: cellInfo?.rect });
  }, []);

  // ─── Ref actions ─────────────────────────────────────────────────────────────

  const applyHighlight = () => {
    if (highlight) viewerRef.current?.setHighlight(highlight);
  };

  const silentHighlight = () => {
    if (highlight) viewerRef.current?.setHighlight(highlight, { silent: true });
  };

  const clearHighlight = () => {
    viewerRef.current?.clearHighlight();
    setSelectionInfo(null);
  };

  const silentClearHighlight = () => {
    viewerRef.current?.clearHighlight({ silent: true });
    setSelectionInfo(null);
  };

  const getInfo = () => {
    const hl = viewerRef.current?.getHighlight();
    const sheets = viewerRef.current?.getSheetNames();
    alert(`Current highlight: ${hl ?? 'none'}\nSheets: ${sheets?.join(', ')}`);
  };

  // ─── Upload screen ───────────────────────────────────────────────────────────

  if (!source) {
    return (
      <div className="demo-upload-overlay">
        <div
          className={`demo-upload-zone ${isDragging ? 'dragging' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} onChange={handleChange} style={{ display: 'none' }} />
          <div className="demo-upload-content">
            <div className="demo-upload-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <polyline points="9 15 12 12 15 15" />
              </svg>
            </div>
            <h2>Open a spreadsheet</h2>
            <p>Drag &amp; drop or click to upload</p>
            <p className="demo-upload-formats">.xlsx &nbsp;·&nbsp; .xls &nbsp;·&nbsp; .csv</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main app ────────────────────────────────────────────────────────────────

  return (
    <div className="demo-app">
      {/* Top bar */}
      <div className="demo-topbar">
        <button className="demo-btn demo-btn-secondary" onClick={() => { setSource(null); setSelectionInfo(null); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Open File
        </button>
        <div className="demo-topbar-title">rc-sheet-viewer-17 &nbsp;·&nbsp; Interactive Demo</div>
        <button className="demo-btn demo-btn-ghost" onClick={() => setPanelOpen((v) => !v)}>
          {panelOpen ? 'Hide Panel' : 'Show Panel'}
        </button>
      </div>

      <div className="demo-body">
        {/* Viewer */}
        <div className="demo-viewer">
          <SheetViewer
            ref={viewerRef}
            source={source}
            mode={mode}
            highlight={highlight || undefined}
            highlightColor={highlightColor || undefined}
            highlightBorderColor={highlightBorderColor || undefined}
            highlightable={highlightable}
            gridLines={gridLines.length > 0 ? gridLines : undefined}
            showToolbar={showToolbar}
            showFileName={showFileName}
            theme={Object.keys(currentTheme).length > 0 ? currentTheme : undefined}
            searchMatchColor={searchMatchColor || undefined}
            searchActiveColor={searchActiveColor || undefined}
            activeSheet={activeSheet}
            onSheetChange={handleSheetChange}
            onCellChange={handleCellChange}
            onSelectionChange={handleSelectionChange}
            downloadable={downloadable}
            searchable={searchable}
            chartable={chartable}
            height="100%"
            width="100%"
          />
        </div>

        {/* Side Panel */}
        {panelOpen && (
          <div className="demo-panel">
            {/* Tabs */}
            <div className="demo-panel-tabs">
              {(['display', 'colors', 'grid', 'callbacks'] as const).map((tab) => (
                <button
                  key={tab}
                  className={`demo-panel-tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'display' && 'Display'}
                  {tab === 'colors' && 'Colors'}
                  {tab === 'grid' && 'Grid Lines'}
                  {tab === 'callbacks' && 'Events'}
                </button>
              ))}
            </div>

            <div className="demo-panel-content">

              {/* ── DISPLAY TAB ── */}
              {activeTab === 'display' && (
                <div className="demo-section-group">
                  <section className="demo-section">
                    <h3 className="demo-section-title">Viewer Mode</h3>
                    <div className="demo-toggle-row">
                      {(['view', 'edit'] as SheetViewerMode[]).map((m) => (
                        <button
                          key={m}
                          className={`demo-toggle-btn ${mode === m ? 'active' : ''}`}
                          onClick={() => setMode(m)}
                        >
                          {m === 'view' ? 'View' : 'Edit'}
                        </button>
                      ))}
                    </div>
                    <p className="demo-hint">Edit mode: double-click a cell to edit</p>
                  </section>

                  <section className="demo-section">
                    <h3 className="demo-section-title">Toolbar & UI</h3>
                    <div className="demo-checkbox-list">
                      <label className="demo-checkbox-row">
                        <input type="checkbox" checked={showToolbar} onChange={(e) => setShowToolbar(e.target.checked)} />
                        Show Toolbar (filename + buttons)
                      </label>
                      <label className="demo-checkbox-row" style={{ paddingLeft: 20, color: showToolbar ? undefined : '#bbb' }}>
                        <input type="checkbox" checked={showFileName} onChange={(e) => setShowFileName(e.target.checked)} disabled={!showToolbar} />
                        Show Filename in Toolbar
                      </label>
                      <label className="demo-checkbox-row">
                        <input type="checkbox" checked={downloadable} onChange={(e) => setDownloadable(e.target.checked)} />
                        Show Download Button
                      </label>
                      <label className="demo-checkbox-row">
                        <input type="checkbox" checked={chartable} onChange={(e) => setChartable(e.target.checked)} />
                        Show Charts Button
                      </label>
                      <label className="demo-checkbox-row">
                        <input type="checkbox" checked={searchable} onChange={(e) => setSearchable(e.target.checked)} />
                        Enable Ctrl+F Search
                      </label>
                      <label className="demo-checkbox-row">
                        <input type="checkbox" checked={highlightable} onChange={(e) => setHighlightable(e.target.checked)} />
                        Show Selection Highlights
                      </label>
                    </div>
                  </section>

                  <section className="demo-section">
                    <h3 className="demo-section-title">Highlight Range</h3>
                    <div className="demo-field-row">
                      <input
                        className="demo-input demo-input-mono"
                        type="text"
                        value={highlight}
                        onChange={(e) => setHighlight(e.target.value)}
                        placeholder="e.g. A1:D10"
                      />
                    </div>
                    <div className="demo-btn-row">
                      <button className="demo-btn demo-btn-sm" onClick={applyHighlight}>Apply</button>
                      <button className="demo-btn demo-btn-sm demo-btn-ghost" onClick={silentHighlight} title="Does not trigger onSelectionChange">
                        Apply (silent)
                      </button>
                      <button className="demo-btn demo-btn-sm demo-btn-ghost" onClick={clearHighlight}>
                        Clear
                      </button>
                      <button className="demo-btn demo-btn-sm demo-btn-ghost" onClick={silentClearHighlight} title="Does not trigger onSelectionChange">
                        Clear (silent)
                      </button>
                      <button className="demo-btn demo-btn-sm demo-btn-ghost" onClick={getInfo}>
                        Get Info
                      </button>
                    </div>
                    <p className="demo-hint">Syntax: A1, A1:D10, B:B, 3:3, A1:B5,D1:E5. Single-cell clicks only focus the cell; they do not create a visible highlight.</p>
                  </section>
                </div>
              )}

              {/* ── COLORS TAB ── */}
              {activeTab === 'colors' && (
                <div className="demo-section-group">
                  <section className="demo-section">
                    <h3 className="demo-section-title">Theme Preset</h3>
                    <select
                      className="demo-select demo-select-full"
                      value={themePreset}
                      onChange={(e) => setThemePreset(e.target.value)}
                    >
                      {Object.entries(THEME_PRESETS).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                    <p className="demo-hint">Overrides the entire color palette via CSS variables</p>
                  </section>

                  <section className="demo-section">
                    <h3 className="demo-section-title">Selection Highlight</h3>
                    <div className="demo-field-labeled">
                      <label>Fill color</label>
                      <div className="demo-color-row">
                        <input type="color" className="demo-color-swatch" value={highlightColor || '#1a73e8'} onChange={(e) => setHighlightColor(e.target.value + '26')} />
                        <input className="demo-input demo-input-mono" type="text" value={highlightColor} onChange={(e) => setHighlightColor(e.target.value)} placeholder="rgba(26,115,232,0.1)" />
                        {highlightColor && <button className="demo-clear-btn" onClick={() => setHighlightColor('')}>✕</button>}
                      </div>
                    </div>
                    <div className="demo-field-labeled">
                      <label>Border color</label>
                      <div className="demo-color-row">
                        <input type="color" className="demo-color-swatch" value={highlightBorderColor || '#1a73e8'} onChange={(e) => setHighlightBorderColor(e.target.value)} />
                        <input className="demo-input demo-input-mono" type="text" value={highlightBorderColor} onChange={(e) => setHighlightBorderColor(e.target.value)} placeholder="#1a73e8" />
                        {highlightBorderColor && <button className="demo-clear-btn" onClick={() => setHighlightBorderColor('')}>✕</button>}
                      </div>
                    </div>
                  </section>

                  <section className="demo-section">
                    <h3 className="demo-section-title">Search Highlight (Ctrl+F)</h3>
                    <div className="demo-field-labeled">
                      <label>Match color</label>
                      <div className="demo-color-row">
                        <input type="color" className="demo-color-swatch" value="#ffd54f" onChange={(e) => setSearchMatchColor(e.target.value + '59')} />
                        <input className="demo-input demo-input-mono" type="text" value={searchMatchColor} onChange={(e) => setSearchMatchColor(e.target.value)} placeholder="rgba(255,213,79,0.35)" />
                        {searchMatchColor && <button className="demo-clear-btn" onClick={() => setSearchMatchColor('')}>✕</button>}
                      </div>
                    </div>
                    <div className="demo-field-labeled">
                      <label>Active match color</label>
                      <div className="demo-color-row">
                        <input type="color" className="demo-color-swatch" value="#ff9800" onChange={(e) => setSearchActiveColor(e.target.value + '8c')} />
                        <input className="demo-input demo-input-mono" type="text" value={searchActiveColor} onChange={(e) => setSearchActiveColor(e.target.value)} placeholder="rgba(255,152,0,0.55)" />
                        {searchActiveColor && <button className="demo-clear-btn" onClick={() => setSearchActiveColor('')}>✕</button>}
                      </div>
                    </div>
                    <p className="demo-hint">Press Ctrl+F to open search and see these colors in action. Search always takes priority over the selection highlight color.</p>
                  </section>
                </div>
              )}

              {/* ── GRID LINES TAB ── */}
              {activeTab === 'grid' && (
                <div className="demo-section-group">
                  <section className="demo-section">
                    <h3 className="demo-section-title">Preset Grid Lines</h3>
                    <div className="demo-preset-list">
                      {Object.entries(GRID_LINE_PRESETS).map(([key, val]) => (
                        <button
                          key={key}
                          className={`demo-preset-btn ${gridLinePreset === key ? 'active' : ''}`}
                          onClick={() => setGridLinePreset(key)}
                        >
                          {val.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="demo-section">
                    <h3 className="demo-section-title">Custom Grid Line</h3>
                    <div className="demo-field-labeled">
                      <label>Range</label>
                      <input
                        className="demo-input demo-input-mono demo-input-full"
                        type="text"
                        value={customGridRange}
                        onChange={(e) => setCustomGridRange(e.target.value)}
                        placeholder="e.g. A1:F20"
                      />
                    </div>
                    <div className="demo-field-labeled">
                      <label>Border color</label>
                      <div className="demo-color-row">
                        <input type="color" className="demo-color-swatch" value={customGridColor} onChange={(e) => setCustomGridColor(e.target.value)} />
                        <input className="demo-input demo-input-mono" type="text" value={customGridColor} onChange={(e) => setCustomGridColor(e.target.value)} />
                      </div>
                    </div>
                    <p className="demo-hint">Adds to the selected preset above. Leave range empty to use only preset.</p>
                  </section>

                  <section className="demo-section">
                    <h3 className="demo-section-title">Active Config</h3>
                    <pre className="demo-code">{JSON.stringify(gridLines, null, 2)}</pre>
                  </section>
                </div>
              )}

              {/* ── CALLBACKS TAB ── */}
              {activeTab === 'callbacks' && (
                <div className="demo-section-group">
                  <section className="demo-section">
                    <h3 className="demo-section-title">onSelectionChange</h3>
                    {selectionInfo ? (
                      <div className="demo-info-card">
                        <div className="demo-info-row">
                          <span className="demo-info-label">Range</span>
                          <span className="demo-info-value demo-mono">{selectionInfo.rangeStr}</span>
                        </div>
                        <div className="demo-info-row">
                          <span className="demo-info-label">Ranges count</span>
                          <span className="demo-info-value">{selectionInfo.ranges.length}</span>
                        </div>
                        {selectionInfo.ranges[0] && (
                          <>
                            <div className="demo-info-row">
                              <span className="demo-info-label">Start cell</span>
                              <span className="demo-info-value demo-mono">
                                {toCol(selectionInfo.ranges[0].startCol)}{selectionInfo.ranges[0].startRow + 1}
                              </span>
                            </div>
                            <div className="demo-info-row">
                              <span className="demo-info-label">End cell</span>
                              <span className="demo-info-value demo-mono">
                                {toCol(selectionInfo.ranges[0].endCol)}{selectionInfo.ranges[0].endRow + 1}
                              </span>
                            </div>
                          </>
                        )}
                        {selectionInfo.cellRect && (
                          <>
                            <div className="demo-info-row">
                              <span className="demo-info-label">Cell top</span>
                              <span className="demo-info-value">{Math.round(selectionInfo.cellRect.top)}px</span>
                            </div>
                            <div className="demo-info-row">
                              <span className="demo-info-label">Cell left</span>
                              <span className="demo-info-value">{Math.round(selectionInfo.cellRect.left)}px</span>
                            </div>
                            <div className="demo-info-row">
                              <span className="demo-info-label">Cell size</span>
                              <span className="demo-info-value">
                                {Math.round(selectionInfo.cellRect.width)} × {Math.round(selectionInfo.cellRect.height)}px
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="demo-hint">Drag-select a range or apply a highlight to see selection info here</p>
                    )}
                  </section>

                  <section className="demo-section">
                    <h3 className="demo-section-title">Imperative Ref</h3>
                    <div className="demo-btn-col">
                      <button className="demo-btn demo-btn-sm demo-btn-full" onClick={() => {
                        const h = viewerRef.current?.getHighlight();
                        setSelectionInfo((prev) => prev ? { ...prev, rangeStr: `getHighlight() → ${h ?? 'null'}` } : null);
                        alert(`getHighlight() = ${h ?? 'null'}`);
                      }}>
                        getHighlight()
                      </button>
                      <button className="demo-btn demo-btn-sm demo-btn-full" onClick={() => {
                        viewerRef.current?.clearHighlight();
                        setSelectionInfo(null);
                      }}>
                        clearHighlight()
                      </button>
                      <button className="demo-btn demo-btn-sm demo-btn-full" onClick={() => {
                        viewerRef.current?.clearHighlight({ silent: true });
                        setSelectionInfo(null);
                      }}>
                        {`clearHighlight({ silent: true })`}
                      </button>
                      <button className="demo-btn demo-btn-sm demo-btn-full" onClick={() => {
                        const data = viewerRef.current?.getSelectedRangeData();
                        alert(`Selected data:\n${JSON.stringify(data, null, 2)}`);
                      }}>
                        getSelectedRangeData()
                      </button>
                      <button className="demo-btn demo-btn-sm demo-btn-full" onClick={() => {
                        const names = viewerRef.current?.getSheetNames();
                        alert(`Sheet names:\n${names?.join('\n') ?? 'none'}`);
                      }}>
                        getSheetNames()
                      </button>
                      <button className="demo-btn demo-btn-sm demo-btn-full" onClick={() => {
                        const d = viewerRef.current?.getSheetData();
                        alert(`Sheet: ${viewerRef.current?.getActiveSheet()}\nRows: ${d?.rows}, Cols: ${d?.cols}`);
                      }}>
                        getSheetData()
                      </button>
                      <button className="demo-btn demo-btn-sm demo-btn-full" onClick={() => {
                        viewerRef.current?.undo();
                      }}>
                        undo()
                      </button>
                      <button className="demo-btn demo-btn-sm demo-btn-full" onClick={() => {
                        viewerRef.current?.redo();
                      }}>
                        redo()
                      </button>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Column index → Excel letter (A, B, ..., Z, AA, ...)
function toCol(n: number): string {
  let s = '';
  for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) {
    s = String.fromCharCode(((x - 1) % 26) + 65) + s;
  }
  return s;
}
