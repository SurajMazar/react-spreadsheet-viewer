import React, { useState, useCallback, useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { useViewerStore, EMPTY_SELECTION } from '../context/ViewerContext';
import { parseRangeExpression, colIndexToLetter } from '../utils/rangeParser';

export default function FormulaBar() {
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
    </div>
  );
}
