import React, { useCallback, useRef, useEffect, useState, useMemo, type MouseEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useViewerStore, EMPTY_SELECTION, EMPTY_RANGES } from '../../context/ViewerContext';
import { colIndexToLetter } from '../../utils/rangeParser';
import { extractCellsFromRange, extractStylesFromRange, copyRangeToClipboard, pasteFromClipboard } from '../../utils/clipboard';
import Cell from './Cell';
import EditableCell from './EditableCell';
import ChartOverlays from '../ChartOverlays';
import { evaluateConditionalFormats } from '../../conditionalFormat/evaluator';
import type { MergeCell, CellStyle, CellValueChange, CellStyleChange } from '../../types';

export const COL_WIDTH = 100;
export const ROW_HEIGHT = 26;
export const ROW_HEADER_WIDTH = 50;
export const COL_HEADER_HEIGHT = 28;

interface EditingCell {
  row: number;
  col: number;
}

interface VirtualGridProps {
  highlightable?: boolean;
}

export default function VirtualGrid({ highlightable = true }: VirtualGridProps) {
  const activeSheet = useViewerStore((s) => s.activeSheet);
  const sheetData = useViewerStore((s) => (s.activeSheet ? s.sheets[s.activeSheet] : null));
  const activeCell = useViewerStore((s) => s.activeCell);
  const setActiveCell = useViewerStore((s) => s.setActiveCell);
  const setSelectionRanges = useViewerStore((s) => s.setSelectionRanges);
  const setRangeInput = useViewerStore((s) => s.setRangeInput);
  const setCellValue = useViewerStore((s) => s.setCellValue);
  const setCellStyle = useViewerStore((s) => s.setCellStyle);
  const setColumnWidth = useViewerStore((s) => s.setColumnWidth);
  const setRowHeight = useViewerStore((s) => s.setRowHeight);
  const copiedRange = useViewerStore((s) => s.copiedRange);
  const setCopiedRange = useViewerStore((s) => s.setCopiedRange);
  const pushUndo = useViewerStore((s) => s.pushUndo);
  const undo = useViewerStore((s) => s.undo);
  const redo = useViewerStore((s) => s.redo);
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

  // Horizontal scroll: Shift+wheel and prevent parent scroll capture in nested containers
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Prevent parent containers from capturing horizontal scroll
      if (Math.abs(e.deltaX) > 0) {
        e.stopPropagation();
      }

      // Shift+wheel → horizontal scroll
      if (e.shiftKey && Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const dataCols = sheetData?.cols || 0;
  const dataRows = sheetData?.rows || 0;
  const colWidths = sheetData?.colWidths;
  const rowHeights = sheetData?.rowHeights;

  // Extend columns and rows beyond data to fill viewport (like Google Sheets)
  const visibleCols = Math.ceil(containerSize.width / COL_WIDTH);
  const visibleRows = Math.ceil(containerSize.height / ROW_HEIGHT);
  const effectiveCols = Math.max(dataCols, visibleCols + 5);
  const effectiveRows = Math.max(dataRows, visibleRows + 10);

  const getColWidth = useCallback(
    (index: number) => (colWidths && index < colWidths.length && colWidths[index]) ? colWidths[index] : COL_WIDTH,
    [colWidths]
  );

  const getRowHeight = useCallback(
    (index: number) => (rowHeights && index < rowHeights.length && rowHeights[index]) ? rowHeights[index] : ROW_HEIGHT,
    [rowHeights]
  );

  const rowVirtualizer = useVirtualizer({
    count: effectiveRows,
    getScrollElement: () => scrollRef.current,
    estimateSize: getRowHeight,
    overscan: 8,
  });

  const colVirtualizer = useVirtualizer({
    count: effectiveCols,
    getScrollElement: () => scrollRef.current,
    estimateSize: getColWidth,
    horizontal: true,
    overscan: 4,
  });

  // Track virtualizer references for scrollToIndex
  const rowVirtualizerRef = useRef(rowVirtualizer);
  const colVirtualizerRef = useRef(colVirtualizer);
  rowVirtualizerRef.current = rowVirtualizer;
  colVirtualizerRef.current = colVirtualizer;

  // Invalidate virtualizer measurement cache when column/row sizes change
  useEffect(() => {
    colVirtualizer.measure();
  }, [colWidths, colVirtualizer]);

  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowHeights, rowVirtualizer]);

  // Auto-scroll to selection (center it in viewport)
  useEffect(() => {
    if (ranges.length > 0) {
      const first = ranges[0];
      rowVirtualizerRef.current.scrollToIndex(first.startRow, { align: 'center' });
      colVirtualizerRef.current.scrollToIndex(first.startCol, { align: 'center' });
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
        const oldValue = sheetData?.data?.[row]?.[col] ?? null;
        setCellValue(activeSheet, row, col, value);
        pushUndo({
          sheetName: activeSheet,
          cellChanges: [{ row, col, oldValue, newValue: value }],
          styleChanges: [],
        });
      }
      setEditingCell(null);
    },
    [activeSheet, setCellValue, sheetData, pushUndo]
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

  // Copy/Paste handlers (Ctrl+C / Ctrl+V / Cmd+C / Cmd+V) and Escape to clear copy indicator
  useEffect(() => {
    const handleCopyPaste = (e: globalThis.KeyboardEvent) => {
      if (!sheetData) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (editingCell) return;

      // Escape clears the copy indicator
      if (e.key === 'Escape') {
        setCopiedRange(null);
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      // Undo: Ctrl+Z
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey)) {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === 'c') {
        e.preventDefault();
        let cellRange;
        if (ranges.length > 0) {
          cellRange = ranges[0];
        } else if (activeCell) {
          cellRange = {
            startRow: activeCell.row,
            startCol: activeCell.col,
            endRow: activeCell.row,
            endCol: activeCell.col,
          };
        }
        if (cellRange) {
          const cells = extractCellsFromRange(cellRange, sheetData);
          const styles = extractStylesFromRange(cellRange, sheetData);
          copyRangeToClipboard(cells, styles);
          setCopiedRange(cellRange);
        }
      }

      if (e.key === 'v' && mode === 'edit' && activeCell && activeSheet) {
        e.preventDefault();
        setCopiedRange(null);
        pasteFromClipboard().then((result) => {
          if (!result || result.values.length === 0) return;
          const { values, styles: pastedStyles } = result;
          const cellChanges: CellValueChange[] = [];
          const styleChanges: CellStyleChange[] = [];

          for (let r = 0; r < values.length; r++) {
            for (let c = 0; c < values[r].length; c++) {
              const targetRow = activeCell.row + r;
              const targetCol = activeCell.col + c;

              const oldValue = sheetData?.data?.[targetRow]?.[targetCol] ?? null;
              cellChanges.push({ row: targetRow, col: targetCol, oldValue, newValue: values[r][c] });
              setCellValue(activeSheet, targetRow, targetCol, values[r][c]);

              const pastedStyle = pastedStyles?.[r]?.[c];
              if (pastedStyle) {
                const oldStyle = sheetData?.styles?.[`${targetRow},${targetCol}`];
                styleChanges.push({ row: targetRow, col: targetCol, oldStyle, newStyle: pastedStyle });
                setCellStyle(activeSheet, targetRow, targetCol, pastedStyle);
              }
            }
          }

          pushUndo({ sheetName: activeSheet, cellChanges, styleChanges });
        });
      }
    };

    window.addEventListener('keydown', handleCopyPaste);
    return () => window.removeEventListener('keydown', handleCopyPaste);
  }, [sheetData, activeCell, ranges, mode, activeSheet, editingCell, setCellValue, setCellStyle, setCopiedRange, pushUndo, undo, redo]);

  // Build a merge lookup map: "row,col" → MergeCell for quick cell-level checks
  const mergeMap = useMemo(() => {
    const map = new Map<string, { merge: MergeCell; isTopLeft: boolean }>();
    if (!sheetData?.merges) return map;
    for (const m of sheetData.merges) {
      for (let r = m.s.r; r <= m.e.r; r++) {
        for (let c = m.s.c; c <= m.e.c; c++) {
          map.set(`${r},${c}`, {
            merge: m,
            isTopLeft: r === m.s.r && c === m.s.c,
          });
        }
      }
    }
    return map;
  }, [sheetData?.merges]);

  // Column/Row resize handling
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const [resizingRow, setResizingRow] = useState<number | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartY = useRef(0);
  const resizeStartSize = useRef(0);

  const onColResizeStart = useCallback(
    (e: MouseEvent, colIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      setResizingCol(colIndex);
      resizeStartX.current = e.clientX;
      resizeStartSize.current = getColWidth(colIndex);
    },
    [getColWidth]
  );

  const onRowResizeStart = useCallback(
    (e: MouseEvent, rowIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      setResizingRow(rowIndex);
      resizeStartY.current = e.clientY;
      resizeStartSize.current = getRowHeight(rowIndex);
    },
    [getRowHeight]
  );

  useEffect(() => {
    if (resizingCol === null && resizingRow === null) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (resizingCol !== null && activeSheet) {
        const delta = e.clientX - resizeStartX.current;
        const newWidth = Math.max(30, resizeStartSize.current + delta);
        setColumnWidth(activeSheet, resizingCol, newWidth);
      }
      if (resizingRow !== null && activeSheet) {
        const delta = e.clientY - resizeStartY.current;
        const newHeight = Math.max(20, resizeStartSize.current + delta);
        setRowHeight(activeSheet, resizingRow, newHeight);
      }
    };

    const handleMouseUp = () => {
      setResizingCol(null);
      setResizingRow(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol, resizingRow, activeSheet, setColumnWidth, setRowHeight]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualCols = colVirtualizer.getVirtualItems();

  if (!sheetData) return null;

  const gridContainerClass = `sv-grid-container${resizingCol !== null ? ' sv-resizing-col' : ''}${resizingRow !== null ? ' sv-resizing-row' : ''}`;

  return (
    <div className={gridContainerClass}>
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
              key={String(vc.key)}
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
              <div
                className="sv-col-resize-handle"
                onMouseDown={(e) => onColResizeStart(e, vc.index)}
              />
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
              key={String(vr.key)}
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
              <div
                className="sv-row-resize-handle"
                onMouseDown={(e) => onRowResizeStart(e, vr.index)}
              />
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
          touchAction: 'pan-x pan-y',
          overscrollBehavior: 'contain',
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
              const row = vr.index;
              const col = vc.index;

              // Check merge status for this cell
              const mergeInfo = mergeMap.get(`${row},${col}`);
              if (mergeInfo && !mergeInfo.isTopLeft) {
                // Cell is hidden by a merge — skip rendering
                return null;
              }

              const value = sheetData.data?.[row]?.[col] ?? '';

              // Calculate cell dimensions (may span multiple cells if merged)
              let cellWidth = vc.size;
              let cellHeight = vr.size;
              if (mergeInfo && mergeInfo.isTopLeft) {
                const m = mergeInfo.merge;
                cellWidth = (m.e.c - m.s.c + 1) * COL_WIDTH;
                cellHeight = (m.e.r - m.s.r + 1) * ROW_HEIGHT;
              }

              // Check if this cell is being edited
              if (
                editingCell &&
                editingCell.row === row &&
                editingCell.col === col
              ) {
                const cellValidation = sheetData.validations?.[`${row},${col}`];
                return (
                  <EditableCell
                    key={`${vr.key}-${vc.key}`}
                    row={row}
                    col={col}
                    value={value}
                    validation={cellValidation}
                    style={{
                      position: 'absolute',
                      top: vr.start,
                      left: vc.start,
                      width: cellWidth,
                      height: cellHeight,
                    }}
                    onCommit={onEditCommit}
                    onCancel={onEditCancel}
                  />
                );
              }

              // Look up cell style, comment, and conditional format
              let cellStyle = sheetData.styles?.[`${row},${col}`];
              const cellComment = sheetData.comments?.[`${row},${col}`];

              // Overlay conditional formatting styles (if rules exist)
              if (sheetData.conditionalFormats && sheetData.conditionalFormats.length > 0) {
                const cfStyle = evaluateConditionalFormats(row, col, value, sheetData.conditionalFormats, sheetData);
                if (cfStyle) {
                  cellStyle = cellStyle ? { ...cellStyle, ...cfStyle } : cfStyle;
                }
              }

              return (
                <Cell
                  key={`${vr.key}-${vc.key}`}
                  rowIndex={row}
                  columnIndex={col}
                  value={value}
                  ranges={highlightable ? ranges : EMPTY_RANGES}
                  activeCell={highlightable ? activeCell : null}
                  cellStyle={cellStyle}
                  comment={cellComment}
                  isMerged={!!mergeInfo}
                  onCellClick={onCellClick}
                  onCellMouseDown={onCellMouseDown}
                  onCellMouseEnter={onCellMouseEnter}
                  onCellDoubleClick={onCellDoubleClick}
                  style={{
                    position: 'absolute',
                    top: vr.start,
                    left: vc.start,
                    width: cellWidth,
                    height: cellHeight,
                  }}
                />
              );
            })
          )}
        </div>

        {/* Marching ants copy indicator */}
        {highlightable && copiedRange && (
          <div
            className="sv-copy-indicator"
            style={{
              top: copiedRange.startRow * ROW_HEIGHT,
              left: copiedRange.startCol * COL_WIDTH,
              width: (copiedRange.endCol - copiedRange.startCol + 1) * COL_WIDTH,
              height: (copiedRange.endRow - copiedRange.startRow + 1) * ROW_HEIGHT,
            }}
          />
        )}

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
