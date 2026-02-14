import React, { useCallback, useRef, useState } from 'react';
import { useViewerStore } from '../context/ViewerContext';
import { colIndexToLetter } from '../utils/rangeParser';
import { downloadAsXlsx, downloadAsCsv } from '../utils/download';

export interface ToolbarProps {
  downloadable?: boolean;
}

export default function Toolbar({ downloadable = false }: ToolbarProps) {
  const fileName = useViewerStore((s) => s.fileName);
  const activeCell = useViewerStore((s) => s.activeCell);
  const activeSheet = useViewerStore((s) => s.activeSheet);
  const toggleChartPanel = useViewerStore((s) => s.toggleChartPanel);
  const showChartPanel = useViewerStore((s) => s.showChartPanel);
  const sheets = useViewerStore((s) => s.sheets);
  const sheetNames = useViewerStore((s) => s.sheetNames);
  const sheetData = useViewerStore((s) => (s.activeSheet ? s.sheets[s.activeSheet] : null));

  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  const cellLabel = activeCell
    ? `${colIndexToLetter(activeCell.col)}${activeCell.row + 1}`
    : '';

  const handleDownloadXlsx = useCallback(() => {
    downloadAsXlsx(sheets, sheetNames, fileName);
    setShowDownloadMenu(false);
  }, [sheets, sheetNames, fileName]);

  const handleDownloadCsv = useCallback(() => {
    downloadAsCsv(sheetData, activeSheet);
    setShowDownloadMenu(false);
  }, [sheetData, activeSheet]);

  return (
    <div className="sv-toolbar">
      <div className="sv-toolbar-left">
        <div className="sv-toolbar-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f9d58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </div>
        <div className="sv-toolbar-file-info">
          <span className="sv-toolbar-filename">{fileName || 'Sheet Viewer'}</span>
        </div>
      </div>

      <div className="sv-toolbar-center">
        {fileName && (
          <>
            <button
              className={`sv-toolbar-btn ${showChartPanel ? 'active' : ''}`}
              onClick={toggleChartPanel}
              title="Charts"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <span>Charts</span>
            </button>

            {downloadable && (
              <div style={{ position: 'relative' }} ref={downloadMenuRef}>
                <button
                  className="sv-toolbar-btn"
                  onClick={() => setShowDownloadMenu((v) => !v)}
                  title="Download"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Download</span>
                </button>
                {showDownloadMenu && (
                  <div className="sv-download-menu">
                    <button className="sv-download-menu-item" onClick={handleDownloadXlsx}>
                      Download as XLSX
                    </button>
                    <button className="sv-download-menu-item" onClick={handleDownloadCsv}>
                      Download as CSV (current sheet)
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="sv-toolbar-right">
        {activeCell && (
          <span className="sv-toolbar-cell-indicator">{cellLabel}</span>
        )}
      </div>
    </div>
  );
}
