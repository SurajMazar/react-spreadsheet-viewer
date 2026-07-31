import React, { useState, useCallback, useRef, useEffect } from 'react';
import Dropdown from 'rc-dropdown';
import 'rc-dropdown/assets/index.css';
import { SheetViewer, defineSheetViewerTool } from '../lib';
import type {
  SheetViewerMode,
  SheetViewerSource,
  SheetViewerHandle,
  SheetViewerTool,
  SheetViewerToolIconProps,
  SheetViewerToolsPlacement,
  CellRange,
  GridLineConfig,
  SheetViewerTheme,
} from '../lib';
import './demo.css';

const ACCEPTED_TYPES = '.xlsx,.xls,.csv';

// ─── Example Tools ─────────────────────────────────────────────────────────────
// Everything below lives entirely outside the library: the viewer renders these
// without knowing what any of them do.

function ClipboardIcon({ size }: SheetViewerToolIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function InfoIcon({ size }: SheetViewerToolIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function ColumnsIcon({ size }: SheetViewerToolIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <line x1="15" y1="4" x2="15" y2="20" />
    </svg>
  );
}

/**
 * Builds the example tool set. `report` is how these tools talk back to the
 * demo — a tool's action is ordinary application code, so it closes over
 * whatever it needs.
 */
function createDemoTools(report: (message: string) => void): SheetViewerTool[] {
  // A plain tool: no configuration, so it is just an object literal.
  const summariseSelection: SheetViewerTool = {
    id: 'summarise-selection',
    label: 'Summarise',
    icon: ClipboardIcon,
    // Labelled, to show the alternative to an icon-only tool.
    showLabel: true,
    // Nothing to summarise without a selection, so grey the tool out.
    isDisabled: (ctx) => ctx.selection.length === 0,
    onClick: (ctx) => {
      const rows = ctx.viewer.getSelectedRangeData();
      if (!rows) {
        report('Nothing selected');
        return;
      }
      const cells = rows.flat();
      const numbers = cells
        .map((v) => (typeof v === 'number' ? v : parseFloat(String(v ?? ''))))
        .filter((n) => Number.isFinite(n));
      const sum = numbers.reduce((a, b) => a + b, 0);
      report(
        `${ctx.viewer.getHighlight() ?? 'selection'}: ${cells.length} cells, ` +
          `${numbers.length} numeric, sum ${sum.toLocaleString()}`
      );
    },
  };

  // A configured tool: `defineSheetViewerTool` infers the config type and
  // type-checks the handler against it, then binds it in.
  const fitColumns = defineSheetViewerTool({
    id: 'fit-columns',
    label: 'Fit columns to content',
    icon: ColumnsIcon,
    config: { maxColumns: 12 },
    onClick: (ctx, config) => {
      const sheet = ctx.sheetData;
      if (!sheet) return;
      const count = Math.min(sheet.cols, config.maxColumns);
      let fitted = 0;
      for (let col = 0; col < count; col++) {
        if (ctx.viewer.autoFitColumn(col) !== null) fitted++;
      }
      report(`Auto-fitted ${fitted} of the first ${count} columns`);
    },
  });

  // Pinned to the opposite end with its own `placement`, which overrides the
  // viewer-wide `toolsPlacement`.
  const sheetInfo: SheetViewerTool = {
    id: 'sheet-info',
    label: 'Sheet info',
    icon: InfoIcon,
    placement: 'right',
    onClick: (ctx) => {
      const sheet = ctx.sheetData;
      if (!sheet) {
        report('No sheet loaded');
        return;
      }
      report(
        `${ctx.activeSheet}: ${sheet.rows} rows × ${sheet.cols} cols · ` +
          `${ctx.sheetNames.length} sheet(s) · zoom ${Math.round(ctx.zoom * 100)}%`
      );
    },
  };

  return [summariseSelection, fitColumns, sheetInfo];
}

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
  const [highlightInput, setHighlightInput] = useState('');
  const [highlight, setHighlight] = useState<string | undefined>(undefined);
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

  // Zoom
  const [zoomable, setZoomable] = useState(true);
  const [zoom, setZoom] = useState(1);

  // Tools
  const [toolsEnabled, setToolsEnabled] = useState(true);
  const [toolMessage, setToolMessage] = useState<string | null>(null);
  const [toolsPlacement, setToolsPlacement] = useState<SheetViewerToolsPlacement>('left');

  // Loading UI
  const [customLoader, setCustomLoader] = useState(false);

  // Sidebar panel
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'display' | 'colors' | 'grid' | 'callbacks'>('display');

  // Ref
  const viewerRef = useRef<SheetViewerHandle>(null);

  // Rebuilt only when the reporting callback changes, so the toolbar buttons
  // are not remounted on every keystroke elsewhere in the demo.
  const demoTools = React.useMemo(() => createDemoTools(setToolMessage), []);

  // Highlight area anchor — one element spanning the whole highlighted range
  const highlightAreaRef = useRef<HTMLDivElement>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  // Read the rect in an effect, never inside onSelectionChange: that callback
  // fires before React commits, so the element is not positioned yet.
  //
  // The element itself tracks the grid (it lives in content coordinates), but a
  // cached DOMRect does not — so re-read it on scroll and whenever the element
  // changes size, otherwise the chip drifts away on scroll or column resize.
  useEffect(() => {
    const read = () =>
      setHighlightRect(highlightAreaRef.current?.getBoundingClientRect() ?? null);
    read();

    const el = highlightAreaRef.current;
    if (!el) return;

    const scroller = document.querySelector('.sv-grid-scroll');
    scroller?.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', read);
    // Catches column/row resize, which moves the box without any scroll event
    const ro = new ResizeObserver(read);
    ro.observe(el);

    return () => {
      scroller?.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
      ro.disconnect();
    };
  }, [selectionInfo, source]);

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
    if (highlightInput) {
      setHighlight(highlightInput);
      viewerRef.current?.setHighlight(highlightInput);
    }
  };

  const silentHighlight = () => {
    if (highlightInput) viewerRef.current?.setHighlight(highlightInput, { silent: true });
  };

  const clearHighlight = () => {
    setHighlight(undefined);
    viewerRef.current?.clearHighlight();
    setSelectionInfo(null);
  };

  const silentClearHighlight = () => {
    viewerRef.current?.clearHighlight({ silent: true });
    setSelectionInfo(null);
  };

  const copyHighlightValues = async () => {
    const rows = viewerRef.current?.getSelectedRangeData();
    if (!rows || rows.length === 0) {
      alert('Nothing highlighted.');
      return;
    }
    const tsv = rows.map((r) => r.map((c) => (c == null ? '' : String(c))).join('\t')).join('\n');
    try {
      await navigator.clipboard.writeText(tsv);
      alert(`Copied ${rows.length} × ${rows[0].length} cells to the clipboard.`);
    } catch {
      alert(`Clipboard blocked. Values:\n\n${tsv}`);
    }
  };

  const getInfo = () => {
    const hl = viewerRef.current?.getHighlight();
    const sheets = viewerRef.current?.getSheetNames();
    alert(`Current highlight: ${hl ?? 'none'}\nSheets: ${sheets?.join(', ')}`);
  };

  const getHighlightEl = () => {
    const el = viewerRef.current?.getHighlightElement();
    if (!el) {
      alert('No highlight element — nothing is highlighted.');
      return;
    }
    const r = el.getBoundingClientRect();
    console.log('Highlight area element:', el);
    alert(
      `Highlight area element (one element for the whole range):\n` +
        `class: ${el.className}\n` +
        `viewport rect: ${Math.round(r.left)}, ${Math.round(r.top)}\n` +
        `size: ${Math.round(r.width)} × ${Math.round(r.height)}px\n` +
        `matches highlightAreaRef: ${el === highlightAreaRef.current}`
    );
  };

  // Overlay for the floating dropdown. A plain element rather than rc-menu, so
  // the demo does not pull in another dependency just to render four rows.
  // Declared after the handlers it references — it is evaluated during render.
  const highlightMenu = (
    <div className="demo-dropdown-menu">
      <div className="demo-dropdown-title">
        {unionLabel(selectionInfo?.ranges)}
        {highlightRect && (
          <span className="demo-dropdown-dim">
            {Math.round(highlightRect.width)} × {Math.round(highlightRect.height)} px
          </span>
        )}
      </div>
      <button type="button" className="demo-dropdown-item" onClick={copyHighlightValues}>
        Copy values
      </button>
      <button type="button" className="demo-dropdown-item" onClick={getHighlightEl}>
        Inspect element
      </button>
      <button type="button" className="demo-dropdown-item" onClick={getInfo}>
        Highlight info
      </button>
      <button
        type="button"
        className="demo-dropdown-item demo-dropdown-danger"
        onClick={clearHighlight}
      >
        Clear highlight
      </button>
    </div>
  );

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
            highlight={highlight}
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
            highlightAreaRef={highlightAreaRef}
            highlightAreaProps={{
              id: 'demo-highlight-area',
              'data-testid': 'highlight-area',
              title: 'Highlighted region',
            }}
            downloadable={downloadable}
            searchable={searchable}
            chartable={chartable}
            zoomable={zoomable}
            onZoomChange={setZoom}
            tools={toolsEnabled ? demoTools : undefined}
            toolsPlacement={toolsPlacement}
            renderLoading={
              customLoader
                ? ({ progress, status, fileName }) => (
                    <div className="demo-custom-loader">
                      <div className="demo-custom-loader-name">{fileName ?? 'Reading file…'}</div>
                      <div className="demo-custom-loader-bar">
                        <div
                          className="demo-custom-loader-fill"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="demo-custom-loader-status">
                        {status || 'Fetching…'} · {Math.round(progress)}%
                      </div>
                    </div>
                  )
                : undefined
            }
            height="100%"
            width="100%"
          />

          {/* Floating rc-dropdown anchored to the highlight area element. The
              trigger is positioned purely from highlightAreaRef.current's
              bounding rect, so it tracks the highlight on scroll and resize. */}
          {highlightRect && highlightRect.width > 0 && (
            <Dropdown
              trigger={['click']}
              animation="slide-up"
              overlay={highlightMenu}
              getPopupContainer={() => document.body}
            >
              <button
                type="button"
                className="demo-highlight-chip"
                style={{ top: highlightRect.top - 26, left: highlightRect.left }}
              >
                {unionLabel(selectionInfo?.ranges)} · {Math.round(highlightRect.width)}×
                {Math.round(highlightRect.height)}px
                <span className="demo-chip-caret" aria-hidden="true">▾</span>
              </button>
            </Dropdown>
          )}
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
                      <label className="demo-checkbox-row">
                        <input type="checkbox" checked={zoomable} onChange={(e) => setZoomable(e.target.checked)} />
                        Show Zoom Control
                      </label>
                    </div>
                  </section>

                  <section className="demo-section">
                    <h3 className="demo-section-title">Zoom</h3>
                    <div className="demo-btn-row">
                      <button className="demo-btn demo-btn-sm demo-btn-ghost" onClick={() => viewerRef.current?.zoomOut()}>
                        Zoom Out
                      </button>
                      <button className="demo-btn demo-btn-sm demo-btn-ghost" onClick={() => viewerRef.current?.zoomIn()}>
                        Zoom In
                      </button>
                      <button className="demo-btn demo-btn-sm demo-btn-ghost" onClick={() => viewerRef.current?.resetZoom()}>
                        Reset
                      </button>
                      <span className="demo-hint" style={{ alignSelf: 'center' }}>
                        {Math.round(zoom * 100)}%
                      </span>
                    </div>
                    <p className="demo-hint">
                      Also available from the dropdown at the start of the formula bar, or Ctrl/Cmd +
                      scroll over the grid.
                    </p>
                  </section>

                  <section className="demo-section">
                    <h3 className="demo-section-title">Tools</h3>
                    <div className="demo-checkbox-list">
                      <label className="demo-checkbox-row">
                        <input type="checkbox" checked={toolsEnabled} onChange={(e) => setToolsEnabled(e.target.checked)} />
                        Register Example Tools
                      </label>
                    </div>
                    <div className="demo-toggle-row" style={{ marginTop: 8 }}>
                      {(['left', 'right'] as SheetViewerToolsPlacement[]).map((side) => (
                        <button
                          key={side}
                          className={`demo-toggle-btn ${toolsPlacement === side ? 'active' : ''}`}
                          onClick={() => setToolsPlacement(side)}
                          disabled={!toolsEnabled}
                        >
                          {side === 'left' ? 'Left' : 'Right'}
                        </button>
                      ))}
                    </div>
                    {toolMessage && <p className="demo-hint">↳ {toolMessage}</p>}
                    <p className="demo-hint">
                      Three example tools passed via the <code>tools</code> prop:{' '}
                      <strong>Summarise</strong> (a plain labelled tool, disabled until you select a
                      range), an icon-only auto-fit tool built with{' '}
                      <code>defineSheetViewerTool</code> so it carries typed config, and a{' '}
                      <strong>Sheet info</strong> tool pinned to the right with its own{' '}
                      <code>placement</code>. The buttons above set <code>toolsPlacement</code>,
                      which the first two follow.
                    </p>
                  </section>

                  <section className="demo-section">
                    <h3 className="demo-section-title">Loading UI</h3>
                    <div className="demo-checkbox-list">
                      <label className="demo-checkbox-row">
                        <input type="checkbox" checked={customLoader} onChange={(e) => setCustomLoader(e.target.checked)} />
                        Use Custom Loading UI
                      </label>
                    </div>
                    <p className="demo-hint">
                      Replaces the built-in card via <code>renderLoading</code>, which receives{' '}
                      <code>progress</code>, <code>status</code>, <code>fileName</code> and{' '}
                      <code>isFetching</code>. Open another file to see it.
                    </p>
                  </section>

                  <section className="demo-section">
                    <h3 className="demo-section-title">Highlight Range</h3>
                    <div className="demo-field-row">
                      <input
                        className="demo-input demo-input-mono"
                        type="text"
                        value={highlightInput}
                        onChange={(e) => setHighlightInput(e.target.value)}
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
                      <button
                        className="demo-btn demo-btn-sm demo-btn-ghost"
                        onClick={getHighlightEl}
                        title="ref.getHighlightElement() — one element spanning the whole highlight"
                      >
                        Get Element
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
                        const ok = viewerRef.current?.scrollToSelection();
                        if (!ok) alert('scrollToSelection() → false (nothing selected)');
                      }}>
                        scrollToSelection()
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

// Label for the highlight-area element: the union box, since that element covers
// the bounding box of every range (not just ranges[0]).
function unionLabel(ranges?: CellRange[]): string {
  if (!ranges || ranges.length === 0) return '';
  let sr = Infinity, sc = Infinity, er = -Infinity, ec = -Infinity;
  for (const r of ranges) {
    sr = Math.min(sr, r.startRow, r.endRow);
    er = Math.max(er, r.startRow, r.endRow);
    sc = Math.min(sc, r.startCol, r.endCol);
    ec = Math.max(ec, r.startCol, r.endCol);
  }
  const box = sr === er && sc === ec
    ? `${toCol(sc)}${sr + 1}`
    : `${toCol(sc)}${sr + 1}:${toCol(ec)}${er + 1}`;
  return ranges.length > 1 ? `${box} (union of ${ranges.length})` : box;
}

// Column index → Excel letter (A, B, ..., Z, AA, ...)
function toCol(n: number): string {
  let s = '';
  for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) {
    s = String.fromCharCode(((x - 1) % 26) + 65) + s;
  }
  return s;
}
