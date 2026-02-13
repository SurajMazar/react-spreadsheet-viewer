import { useCallback, useRef, useEffect, useState, type MouseEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useViewerStore, EMPTY_SELECTION, EMPTY_RANGES } from '../../context/ViewerContext';
import { colIndexToLetter } from '../../utils/rangeParser';
import Cell from './Cell';
import EditableCell from './EditableCell';
import ChartOverlays from '../ChartOverlays';

export const COL_WIDTH = 100;
export const ROW_HEIGHT = 26;
export const ROW_HEADER_WIDTH = 50;
export const COL_HEADER_HEIGHT = 28;

interface EditingCell {
  row: number;
  col: number;
}

export default function VirtualGrid() {
  const activeSheet = useViewerStore((s) => s.activeSheet);
  const sheetData = useViewerStore((s) => (s.activeSheet ? s.sheets[s.activeSheet] : null));
  const activeCell = useViewerStore((s) => s.activeCell);
  const setActiveCell = useViewerStore((s) => s.setActiveCell);
  const setSelectionRanges = useViewerStore((s) => s.setSelectionRanges);
  const setRangeInput = useViewerStore((s) => s.setRangeInput);
  const setCellValue = useViewerStore((s) => s.setCellValue);
  const mode = useViewerStore((s) => s.mode);

  const currentSelection = useViewerStore(
    (s) => (s.activeSheet ? s.selections[s.activeSheet] : null) ?? EMPTY_SELECTION
  );
  const ranges = currentSelection.ranges ?? EMPTY_RANGES;

  const scrollRef = useRef<HTMLDivElement>(null);
  const isSelecting = useRef(false);
  const selectionStart = useRef<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [scrollOffset, setScrollOffset] = useState({ top: 0, left: 0 });

  // Measure the container
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setContainerSize({ width, height });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Keep scroll offset in sync for header positioning
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      setScrollOffset({ top: el.scrollTop, left: el.scrollLeft });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const dataCols = sheetData?.cols || 0;
  const dataRows = sheetData?.rows || 0;

  // Extend columns and rows beyond data to fill viewport (like Google Sheets)
  const visibleCols = Math.ceil(containerSize.width / COL_WIDTH);
  const visibleRows = Math.ceil(containerSize.height / ROW_HEIGHT);
  const effectiveCols = Math.max(dataCols, visibleCols + 5);
  const effectiveRows = Math.max(dataRows, visibleRows + 10);

  const rowVirtualizer = useVirtualizer({
    count: effectiveRows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const colVirtualizer = useVirtualizer({
    count: effectiveCols,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => COL_WIDTH,
    horizontal: true,
    overscan: 4,
  });

  // Track virtualizer references for scrollToIndex
  const rowVirtualizerRef = useRef(rowVirtualizer);
  const colVirtualizerRef = useRef(colVirtualizer);
  rowVirtualizerRef.current = rowVirtualizer;
  colVirtualizerRef.current = colVirtualizer;

  // Auto-scroll to selection
  useEffect(() => {
    if (ranges.length > 0) {
      const first = ranges[0];
      rowVirtualizerRef.current.scrollToIndex(first.startRow, { align: 'auto' });
      colVirtualizerRef.current.scrollToIndex(first.startCol, { align: 'auto' });
    }
  }, [ranges]);

  // Auto-scroll to active cell
  useEffect(() => {
    if (activeCell) {
      rowVirtualizerRef.current.scrollToIndex(activeCell.row, { align: 'auto' });
      colVirtualizerRef.current.scrollToIndex(activeCell.col, { align: 'auto' });
    }
  }, [activeCell]);

  const onCellClick = useCallback(
    (row: number, col: number) => {
      setEditingCell(null);
      setActiveCell(row, col);
      const label = `${colIndexToLetter(col)}${row + 1}`;
      if (activeSheet) {
        setRangeInput(activeSheet, label);
        setSelectionRanges(activeSheet, [], '');
      }
    },
    [activeSheet, setActiveCell, setRangeInput, setSelectionRanges]
  );

  const onCellDoubleClick = useCallback(
    (row: number, col: number) => {
      if (mode !== 'edit') return;
      setEditingCell({ row, col });
    },
    [mode]
  );

  const onEditCommit = useCallback(
    (row: number, col: number, value: string) => {
      if (activeSheet) {
        setCellValue(activeSheet, row, col, value);
      }
      setEditingCell(null);
    },
    [activeSheet, setCellValue]
  );

  const onEditCancel = useCallback(() => {
    setEditingCell(null);
  }, []);

  const onCellMouseDown = useCallback(
    (e: MouseEvent, row: number, col: number) => {
      if (e.button !== 0) return;
      isSelecting.current = true;
      selectionStart.current = { row, col };
      setActiveCell(row, col);
    },
    [setActiveCell]
  );

  const onCellMouseEnter = useCallback(
    (_e: MouseEvent, row: number, col: number) => {
      if (!isSelecting.current || !selectionStart.current || !activeSheet) return;
      const start = selectionStart.current;
      const range = {
        startRow: Math.min(start.row, row),
        startCol: Math.min(start.col, col),
        endRow: Math.max(start.row, row),
        endCol: Math.max(start.col, col),
      };
      const label = `${colIndexToLetter(range.startCol)}${range.startRow + 1}:${colIndexToLetter(range.endCol)}${range.endRow + 1}`;
      setSelectionRanges(activeSheet, [range], label);
      setRangeInput(activeSheet, label);
    },
    [activeSheet, setSelectionRanges, setRangeInput]
  );

  useEffect(() => {
    const handleMouseUp = () => {
      isSelecting.current = false;
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (!activeCell || !sheetData) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (editingCell) return;

      let newRow = activeCell.row;
      let newCol = activeCell.col;

      switch (e.key) {
        case 'ArrowUp':
          newRow = Math.max(0, newRow - 1);
          break;
        case 'ArrowDown':
          newRow = Math.min(effectiveRows - 1, newRow + 1);
          break;
        case 'ArrowLeft':
          newCol = Math.max(0, newCol - 1);
          break;
        case 'ArrowRight':
          newCol = Math.min(effectiveCols - 1, newCol + 1);
          break;
        case 'Tab':
          e.preventDefault();
          newCol = e.shiftKey
            ? Math.max(0, newCol - 1)
            : Math.min(effectiveCols - 1, newCol + 1);
          break;
        case 'Enter':
          if (mode === 'edit' && !editingCell) {
            e.preventDefault();
            setEditingCell({ row: activeCell.row, col: activeCell.col });
            return;
          }
          newRow = Math.min(effectiveRows - 1, newRow + 1);
          break;
        case 'Home':
          newCol = 0;
          if (e.ctrlKey) newRow = 0;
          break;
        case 'End':
          newCol = dataCols - 1;
          if (e.ctrlKey) newRow = dataRows - 1;
          break;
        case 'F2':
          if (mode === 'edit') {
            e.preventDefault();
            setEditingCell({ row: activeCell.row, col: activeCell.col });
            return;
          }
          break;
        default:
          return;
      }

      e.preventDefault();
      setActiveCell(newRow, newCol);
      const label = `${colIndexToLetter(newCol)}${newRow + 1}`;
      if (activeSheet) {
        setRangeInput(activeSheet, label);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCell, sheetData, activeSheet, setActiveCell, setRangeInput, effectiveRows, effectiveCols, dataRows, dataCols, mode, editingCell]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualCols = colVirtualizer.getVirtualItems();

  if (!sheetData) return null;

  return (
    <div className="sv-grid-container">
      {/* Top-left corner */}
      <div
        className="sv-grid-corner"
        style={{ width: ROW_HEADER_WIDTH, height: COL_HEADER_HEIGHT }}
      />

      {/* Column headers */}
      <div
        className="sv-col-headers"
        style={{
          left: ROW_HEADER_WIDTH,
          width: `calc(100% - ${ROW_HEADER_WIDTH}px)`,
          height: COL_HEADER_HEIGHT,
        }}
      >
        <div
          className="sv-col-headers-inner"
          style={{
            width: colVirtualizer.getTotalSize(),
            height: '100%',
            position: 'relative',
            transform: `translateX(-${scrollOffset.left}px)`,
          }}
        >
          {virtualCols.map((vc) => (
            <div
              key={vc.key}
              className="sv-col-header"
              style={{
                position: 'absolute',
                left: vc.start,
                width: vc.size,
                height: COL_HEADER_HEIGHT,
                top: 0,
              }}
            >
              {colIndexToLetter(vc.index)}
            </div>
          ))}
        </div>
      </div>

      {/* Row headers */}
      <div
        className="sv-row-headers"
        style={{
          top: COL_HEADER_HEIGHT,
          width: ROW_HEADER_WIDTH,
          height: `calc(100% - ${COL_HEADER_HEIGHT}px)`,
        }}
      >
        <div
          className="sv-row-headers-inner"
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
            transform: `translateY(-${scrollOffset.top}px)`,
          }}
        >
          {virtualRows.map((vr) => (
            <div
              key={vr.key}
              className="sv-row-header"
              style={{
                position: 'absolute',
                top: vr.start,
                height: vr.size,
                width: ROW_HEADER_WIDTH,
                left: 0,
              }}
            >
              {vr.index + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Main scrollable grid area */}
      <div
        ref={scrollRef}
        className="sv-grid-scroll"
        style={{
          position: 'absolute',
          top: COL_HEADER_HEIGHT,
          left: ROW_HEADER_WIDTH,
          right: 0,
          bottom: 0,
          overflow: 'auto',
        }}
      >
        {/* Sizer div */}
        <div
          style={{
            width: colVirtualizer.getTotalSize(),
            height: rowVirtualizer.getTotalSize(),
            position: 'relative',
          }}
        >
          {/* Render visible cells */}
          {virtualRows.map((vr) =>
            virtualCols.map((vc) => {
              const value = sheetData.data?.[vr.index]?.[vc.index] ?? '';

              // Check if this cell is being edited
              if (
                editingCell &&
                editingCell.row === vr.index &&
                editingCell.col === vc.index
              ) {
                return (
                  <EditableCell
                    key={`${vr.key}-${vc.key}`}
                    row={vr.index}
                    col={vc.index}
                    value={value}
                    style={{
                      position: 'absolute',
                      top: vr.start,
                      left: vc.start,
                      width: vc.size,
                      height: vr.size,
                    }}
                    onCommit={onEditCommit}
                    onCancel={onEditCancel}
                  />
                );
              }

              // Look up cell style from the parsed styles map
              const cellStyle = sheetData.styles?.[`${vr.index},${vc.index}`];

              return (
                <Cell
                  key={`${vr.key}-${vc.key}`}
                  rowIndex={vr.index}
                  columnIndex={vc.index}
                  value={value}
                  ranges={ranges}
                  activeCell={activeCell}
                  cellStyle={cellStyle}
                  onCellClick={onCellClick}
                  onCellMouseDown={onCellMouseDown}
                  onCellMouseEnter={onCellMouseEnter}
                  onCellDoubleClick={onCellDoubleClick}
                  style={{
                    position: 'absolute',
                    top: vr.start,
                    left: vc.start,
                    width: vc.size,
                    height: vr.size,
                  }}
                />
              );
            })
          )}
        </div>

        {/* Chart overlays */}
        <div
          className="sv-chart-overlays-container"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: colVirtualizer.getTotalSize(),
            height: rowVirtualizer.getTotalSize(),
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          <ChartOverlays />
        </div>
      </div>
    </div>
  );
}
