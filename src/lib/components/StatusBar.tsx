import React, { useMemo } from 'react';
import { useViewerStore, EMPTY_SELECTION } from '../context/ViewerContext';

export default function StatusBar() {
  const sheetData = useViewerStore((s) => (s.activeSheet ? s.sheets[s.activeSheet] : null));
  const currentSelection = useViewerStore(
    (s) => (s.activeSheet ? s.selections[s.activeSheet] : null) ?? EMPTY_SELECTION
  );

  const summary = useMemo(() => {
    if (!sheetData || !currentSelection.ranges?.length) return '';

    const range = currentSelection.ranges[0];
    let sum = 0;
    let count = 0;
    let numCount = 0;

    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        const val = sheetData.data[r]?.[c];
        if (val !== '' && val !== undefined && val !== null) {
          count++;
          const num = parseFloat(String(val));
          if (!isNaN(num)) {
            sum += num;
            numCount++;
          }
        }
      }
    }

    const parts: string[] = [];
    if (count > 0) parts.push(`Count: ${count.toLocaleString()}`);
    if (numCount > 0) {
      parts.push(`Sum: ${sum.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
      parts.push(`Avg: ${(sum / numCount).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
    }
    return parts.join('    ');
  }, [sheetData, currentSelection.ranges]);

  if (!sheetData) return null;

  return (
    <div className="sv-status-bar">
      <div className="sv-status-bar-left">
        <span>
          {sheetData.rows.toLocaleString()} rows &times; {sheetData.cols.toLocaleString()} cols
        </span>
      </div>
      <div className="sv-status-bar-right">
        {summary && <span className="sv-status-bar-summary">{summary}</span>}
      </div>
    </div>
  );
}
