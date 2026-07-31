import React, { useState, useCallback, useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { useViewerStore, EMPTY_SELECTION } from '../context/ViewerContext';
import { parseRangeExpression, colIndexToLetter } from '../utils/rangeParser';
import ZoomControl from './ZoomControl';
import ToolsSection from './ToolsSection';
import type { SheetViewerHandle, SheetViewerTool, SheetViewerToolsPlacement } from '../types';

export interface FormulaBarProps {
  /** Show the zoom control. */
  zoomable?: boolean;
  /** Which end of the bar the zoom control sits at. */
  zoomPlacement?: SheetViewerToolsPlacement;
  /** Consumer-registered tools. */
  tools?: SheetViewerTool[];
  /** Which end of the bar the tools sit at. */
  toolsPlacement?: SheetViewerToolsPlacement;
  /** Imperative API passed to each tool's context. */
  viewerApi?: SheetViewerHandle;
}

export default function FormulaBar({
  zoomable = true,
  zoomPlacement = 'left',
  tools,
  toolsPlacement = 'left',
  viewerApi,
}: FormulaBarProps) {
  const activeSheet = useViewerStore((s) => s.activeSheet);
  const activeCell = useViewerStore((s) => s.activeCell);
  const setSelectionRanges = useViewerStore((s) => s.setSelectionRanges);
  const setRangeInput = useViewerStore((s) => s.setRangeInput);
  const getCurrentSheetData = useViewerStore((s) => s.getCurrentSheetData);

  const currentSelection = useViewerStore(
    (s) => (s.activeSheet ? s.selections[s.activeSheet] : null) ?? EMPTY_SELECTION
  );

  const [localInput, setLocalInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalInput(currentSelection.rangeInput || '');
  }, [currentSelection.rangeInput, activeSheet]);

  useEffect(() => {
    if (activeCell && !currentSelection.rangeInput) {
      const label = `${colIndexToLetter(activeCell.col)}${activeCell.row + 1}`;
      setLocalInput(label);
    }
  }, [activeCell, currentSelection.rangeInput]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const sheetData = getCurrentSheetData();
      if (!sheetData || !activeSheet) return;

      const ranges = parseRangeExpression(localInput, sheetData.rows, sheetData.cols);
      setSelectionRanges(activeSheet, ranges, localInput);
      setRangeInput(activeSheet, localInput);
      inputRef.current?.blur();
    },
    [localInput, activeSheet, getCurrentSheetData, setSelectionRanges, setRangeInput]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setLocalInput(currentSelection.rangeInput || '');
        inputRef.current?.blur();
      }
    },
    [currentSelection.rangeInput]
  );

  /**
   * Tools for one end of the bar. A tool's own `placement` wins over the
   * viewer-wide `toolsPlacement`, so most tools follow the default while an
   * individual one can be pinned to the opposite end.
   *
   * Tools need the imperative API to act on the viewer; without it there is
   * nothing for them to drive, so none are rendered.
   */
  const toolsFor = (side: SheetViewerToolsPlacement) =>
    viewerApi ? (tools ?? []).filter((tool) => (tool.placement ?? toolsPlacement) === side) : [];

  /**
   * One action group per end of the bar. Tools and zoom are placed
   * independently, so they may share a group or sit at opposite ends; a group
   * with nothing in it is not rendered at all, leaving no stray divider.
   */
  const renderActions = (side: SheetViewerToolsPlacement) => {
    const sideTools = toolsFor(side);
    const showTools = sideTools.length > 0;
    const showZoom = zoomable && zoomPlacement === side;
    if (!showTools && !showZoom) return null;

    return (
      <div className={`sv-formula-bar-actions sv-formula-bar-actions-${side}`}>
        {showTools && <ToolsSection tools={sideTools} viewer={viewerApi!} />}
        {showTools && showZoom && <div className="sv-toolbar-divider" />}
        {showZoom && <ZoomControl align={side} />}
      </div>
    );
  };

  const cellValue = useViewerStore((s) => {
    if (!s.activeCell || !s.activeSheet) return '';
    const sheet = s.sheets[s.activeSheet];
    if (!sheet) return '';
    const row = sheet.data[s.activeCell.row];
    if (!row) return '';
    return row[s.activeCell.col] ?? '';
  });

  return (
    <div className="sv-formula-bar">
      {/* Tools and zoom live in the formula bar rather than the toolbar, so they
          stay reachable even when `showToolbar` is false. */}
      {renderActions('left')}

      <div className="sv-formula-bar-cell-ref">
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="sv-formula-bar-range-input"
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="A1 or A1:B10"
            spellCheck={false}
          />
        </form>
      </div>
      <div className="sv-formula-bar-separator" />
      <div className="sv-formula-bar-fx">
        <span className="sv-formula-bar-fx-label">fx</span>
      </div>
      <div className="sv-formula-bar-value">
        <input
          type="text"
          className="sv-formula-bar-value-input"
          value={String(cellValue ?? '')}
          readOnly
          placeholder=""
        />
      </div>

      {renderActions('right')}
    </div>
  );
}
