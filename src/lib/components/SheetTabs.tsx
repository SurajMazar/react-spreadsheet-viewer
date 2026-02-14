import React, { useCallback } from 'react';
import { useViewerStore } from '../context/ViewerContext';

export interface SheetTabsProps {
  onSheetChange?: (name: string) => void;
}

export default function SheetTabs({ onSheetChange }: SheetTabsProps) {
  const sheetNames = useViewerStore((s) => s.sheetNames);
  const activeSheet = useViewerStore((s) => s.activeSheet);
  const setActiveSheet = useViewerStore((s) => s.setActiveSheet);
  const sheets = useViewerStore((s) => s.sheets);

  const handleTabClick = useCallback(
    (name: string) => {
      setActiveSheet(name);
      onSheetChange?.(name);
    },
    [setActiveSheet, onSheetChange]
  );

  if (sheetNames.length === 0) return null;

  return (
    <div className="sv-sheet-tabs">
      <div className="sv-sheet-tabs-scroll">
        {sheetNames.map((name) => {
          const rowCount = sheets[name]?.rows || 0;
          return (
            <button
              key={name}
              className={`sv-sheet-tab ${name === activeSheet ? 'active' : ''}`}
              onClick={() => handleTabClick(name)}
              title={`${name} (${rowCount.toLocaleString()} rows)`}
            >
              <span className="sv-sheet-tab-name">{name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
