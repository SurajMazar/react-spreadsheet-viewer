import { describe, it, expect, vi } from 'vitest';
import { defineSheetViewerTool } from '../defineTool';
import type {
  SheetViewerHandle,
  SheetViewerToolContext,
  SheetViewerToolClickContext,
} from '../../types';

const context: SheetViewerToolContext = {
  viewer: {} as SheetViewerHandle,
  fileName: 'book.xlsx',
  sheetNames: ['Sheet1'],
  activeSheet: 'Sheet1',
  sheetData: null,
  selection: [],
  activeCell: null,
  zoom: 1,
  mode: 'view',
};

const clickContext: SheetViewerToolClickContext = {
  ...context,
  element: {} as HTMLButtonElement,
};

describe('defineSheetViewerTool', () => {
  it('carries the identity fields through unchanged', () => {
    const icon = () => null;
    const tool = defineSheetViewerTool({
      id: 'my-tool',
      label: 'My Tool',
      icon,
      showLabel: true,
      config: { greeting: 'hi' },
      onClick: () => {},
    });

    expect(tool.id).toBe('my-tool');
    expect(tool.label).toBe('My Tool');
    expect(tool.icon).toBe(icon);
    expect(tool.showLabel).toBe(true);
  });

  it('binds the config into onClick', () => {
    const onClick = vi.fn();
    const config = { format: 'csv', rows: 10 };
    const tool = defineSheetViewerTool({
      id: 'export',
      label: 'Export',
      icon: () => null,
      config,
      onClick,
    });

    tool.onClick(clickContext);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(clickContext, config);
  });

  it('binds the config into isDisabled and isActive', () => {
    const tool = defineSheetViewerTool({
      id: 'toggle',
      label: 'Toggle',
      icon: () => null,
      config: { requiresSelection: true, activeWhenZoomed: 1.5 },
      onClick: () => {},
      isDisabled: (ctx, config) => config.requiresSelection && ctx.selection.length === 0,
      isActive: (ctx, config) => ctx.zoom === config.activeWhenZoomed,
    });

    expect(tool.isDisabled?.(context)).toBe(true);
    expect(
      tool.isDisabled?.({
        ...context,
        selection: [{ startRow: 0, startCol: 0, endRow: 0, endCol: 0 }],
      })
    ).toBe(false);

    expect(tool.isActive?.(context)).toBe(false);
    expect(tool.isActive?.({ ...context, zoom: 1.5 })).toBe(true);
  });

  it('leaves optional predicates absent when the definition omits them', () => {
    const tool = defineSheetViewerTool({
      id: 'plain',
      label: 'Plain',
      icon: () => null,
      config: undefined,
      onClick: () => {},
    });

    expect(tool.isDisabled).toBeUndefined();
    expect(tool.isActive).toBeUndefined();
    expect('isDisabled' in tool).toBe(false);
  });

  it('does not leak the config onto the returned tool', () => {
    const tool = defineSheetViewerTool({
      id: 'x',
      label: 'X',
      icon: () => null,
      config: { secret: true },
      onClick: () => {},
    });

    expect('config' in tool).toBe(false);
  });
});
