import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useViewerStore } from '../context/ViewerContext';
import { formatZoomLabel } from '../utils/zoom';
import type { SheetViewerToolsPlacement } from '../types';

export interface ZoomControlProps {
  /**
   * Which edge the menu is anchored to. Mirrors the control's own position in
   * the row, so a control at the right end opens a menu that grows leftwards
   * instead of off the edge of the viewer.
   */
  align?: SheetViewerToolsPlacement;
}

/**
 * Zoom picker for the toolbar — the same shape as the one in Google Sheets:
 * a button showing the current level, opening a list of preset levels.
 *
 * Levels and bounds come from the store, which `SheetViewer` keeps in sync with
 * the `zoomLevels` / `minZoom` / `maxZoom` props, so a consumer can offer their
 * own set without this component knowing anything about it.
 */
export default function ZoomControl({ align = 'left' }: ZoomControlProps) {
  const zoom = useViewerStore((s) => s.zoom);
  const zoomLevels = useViewerStore((s) => s.zoomLevels);
  const minZoom = useViewerStore((s) => s.minZoom);
  const maxZoom = useViewerStore((s) => s.maxZoom);
  const setZoom = useViewerStore((s) => s.setZoom);

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape, so the menu never outlives its context.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: globalThis.MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selectLevel = useCallback(
    (level: number) => {
      setZoom(level);
      setOpen(false);
    },
    [setZoom]
  );

  const visibleLevels = zoomLevels.filter((level) => level >= minZoom && level <= maxZoom);

  return (
    <div className="sv-zoom-control" ref={containerRef}>
      <button
        type="button"
        className={`sv-zoom-trigger${open ? ' active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Zoom"
        aria-label="Zoom"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="sv-zoom-value">{formatZoomLabel(zoom)}</span>
        <svg
          className={`sv-zoom-caret${open ? ' open' : ''}`}
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className={`sv-zoom-menu sv-zoom-menu-${align}`}
          role="listbox"
          aria-label="Zoom level"
        >
          {visibleLevels.map((level) => (
            <button
              key={level}
              type="button"
              role="option"
              aria-selected={level === zoom}
              className={`sv-zoom-menu-item${level === zoom ? ' active' : ''}`}
              onClick={() => selectLevel(level)}
            >
              {formatZoomLabel(level)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
