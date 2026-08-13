import React, { isValidElement, useCallback, type MouseEvent } from 'react';
import { useViewerStore, EMPTY_RANGES } from '../context/ViewerContext';
import type {
  SheetViewerHandle,
  SheetViewerTool,
  SheetViewerToolContext,
  SheetViewerToolIcon,
} from '../types';

/** Pixel size tool icons are drawn at, matching the built-in toolbar icons. */
const TOOL_ICON_SIZE = 16;

export interface ToolsSectionProps {
  /** Tools registered through the `tools` prop, rendered in order. */
  tools: SheetViewerTool[];
  /** The viewer's imperative API, injected into every tool's context. */
  viewer: SheetViewerHandle;
}

/**
 * Renders a tool's icon.
 *
 * `isValidElement` rather than a `typeof === 'function'` check, so components
 * wrapped in `memo` or `forwardRef` — which are objects, not functions — are
 * still recognised as components rather than mistaken for elements.
 */
function ToolIcon({ icon }: { icon: SheetViewerToolIcon }) {
  if (isValidElement(icon)) {
    return <span className="sv-tool-icon">{icon}</span>;
  }
  const Icon = icon as React.ComponentType<{ size: number }>;
  return (
    <span className="sv-tool-icon">
      <Icon size={TOOL_ICON_SIZE} />
    </span>
  );
}

/**
 * The toolbar's Tools section.
 *
 * Everything it knows about a tool comes from the tool itself, so adding
 * functionality never means editing the viewer. It assembles the context each
 * tool is called with, from this viewer instance's store plus the imperative
 * API handed down from `SheetViewer`.
 */
export default function ToolsSection({ tools, viewer }: ToolsSectionProps) {
  const fileName = useViewerStore((s) => s.fileName);
  const sheetNames = useViewerStore((s) => s.sheetNames);
  const activeSheet = useViewerStore((s) => s.activeSheet);
  const sheetData = useViewerStore((s) => (s.activeSheet ? s.sheets[s.activeSheet] : null));
  const activeCell = useViewerStore((s) => s.activeCell);
  const zoom = useViewerStore((s) => s.zoom);
  const mode = useViewerStore((s) => s.mode);
  const selection = useViewerStore(
    (s) => (s.activeSheet ? s.selections[s.activeSheet]?.ranges : undefined) ?? EMPTY_RANGES
  );

  const buildContext = useCallback(
    (): SheetViewerToolContext => ({
      viewer,
      fileName,
      sheetNames,
      activeSheet,
      sheetData: sheetData ?? null,
      selection,
      activeCell,
      zoom,
      mode,
    }),
    [viewer, fileName, sheetNames, activeSheet, sheetData, selection, activeCell, zoom, mode]
  );

  const handleClick = useCallback(
    (tool: SheetViewerTool, e: MouseEvent<HTMLButtonElement>) => {
      tool.onClick({ ...buildContext(), element: e.currentTarget });
    },
    [buildContext]
  );

  if (tools.length === 0) return null;

  const context = buildContext();

  return (
    <div className="sv-toolbar-tools" role="group" aria-label="Tools">
      {tools.map((tool) => {
        const disabled = tool.isDisabled ? tool.isDisabled(context) : false;
        const active = tool.isActive ? tool.isActive(context) : false;

        return (
          <button
            key={tool.id}
            type="button"
            className={`sv-toolbar-btn sv-tool-btn${active ? ' active' : ''}`}
            data-tool-id={tool.id}
            title={tool.label}
            aria-label={tool.label}
            aria-pressed={tool.isActive ? active : undefined}
            disabled={disabled}
            onClick={(e) => handleClick(tool, e)}
          >
            <ToolIcon icon={tool.icon} />
            {tool.showLabel && <span>{tool.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
