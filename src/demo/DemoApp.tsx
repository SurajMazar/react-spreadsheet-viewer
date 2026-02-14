import React, { useState, useCallback, useRef } from 'react';
import { SheetViewer } from '../lib';
import type { SheetViewerMode, SheetViewerSource } from '../lib';
import './demo.css';

const ACCEPTED_TYPES = '.xlsx,.xls,.csv';

export default function DemoApp() {
  const [source, setSource] = useState<SheetViewerSource | null>(null);
  const [mode, setMode] = useState<SheetViewerMode>('view');
  const [highlight, setHighlight] = useState('');
  const [activeSheet, setActiveSheet] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback((file: File | undefined) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      alert('Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
      return;
    }
    setSource(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = '';
  }, [handleFile]);

  const handleSheetChange = useCallback((name: string) => {
    setActiveSheet(name);
  }, []);

  const handleCellChange = useCallback((sheet: string, row: number, col: number, value: unknown) => {
    console.log(`Cell changed: ${sheet} [${row},${col}] = ${value}`);
  }, []);

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
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleChange}
            style={{ display: 'none' }}
          />
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
            <p className="demo-upload-formats">.xlsx, .xls, .csv</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="demo-app">
      <div className="demo-controls">
        <button
          className="demo-btn"
          onClick={() => { setSource(null); setActiveSheet(undefined); setHighlight(''); }}
        >
          Open New File
        </button>
        <div className="demo-control-separator" />
        <label className="demo-label">Mode:</label>
        <select className="demo-select" value={mode} onChange={(e) => setMode(e.target.value as SheetViewerMode)}>
          <option value="view">View</option>
          <option value="edit">Edit</option>
        </select>
        <div className="demo-control-separator" />
        <label className="demo-label">Highlight:</label>
        <input
          className="demo-input"
          type="text"
          value={highlight}
          onChange={(e) => setHighlight(e.target.value)}
          placeholder="e.g. A1:D10"
        />
      </div>
      <div className="demo-viewer">
        <SheetViewer
          source={source}
          mode={mode}
          highlight={highlight || undefined}
          activeSheet={activeSheet}
          onSheetChange={handleSheetChange}
          onCellChange={handleCellChange}
          downloadable
          searchable
          height="100%"
          width="100%"
        />
      </div>
    </div>
  );
}
