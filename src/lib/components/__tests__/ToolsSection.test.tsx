import React, { memo } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ToolsSection from '../ToolsSection';
import { ViewerProvider } from '../../context/ViewerContext';
import { defineSheetViewerTool } from '../../tools/defineTool';
import type { SheetViewerHandle, SheetViewerTool } from '../../types';

const viewer = { getFileName: () => 'book.xlsx' } as unknown as SheetViewerHandle;

const StarIcon = ({ size }: { size: number }) => (
  <svg data-testid="star-icon" width={size} height={size} />
);

function renderTools(tools: SheetViewerTool[]) {
  return render(
    <ViewerProvider>
      <ToolsSection tools={tools} viewer={viewer} />
    </ViewerProvider>
  );
}

function tool(overrides: Partial<SheetViewerTool> = {}): SheetViewerTool {
  return {
    id: 'star',
    label: 'Star it',
    icon: StarIcon,
    onClick: vi.fn(),
    ...overrides,
  };
}

describe('ToolsSection — Rendering', () => {
  it('renders nothing when no tools are registered', () => {
    const { container } = renderTools([]);
    expect(container.firstChild).toBeNull();
  });

  it('renders one button per tool, in order', () => {
    renderTools([tool({ id: 'a', label: 'First' }), tool({ id: 'b', label: 'Second' })]);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].getAttribute('data-tool-id')).toBe('a');
    expect(buttons[1].getAttribute('data-tool-id')).toBe('b');
  });

  it('uses the label as tooltip and accessible name', () => {
    renderTools([tool()]);
    const button = screen.getByRole('button', { name: 'Star it' });
    expect(button.getAttribute('title')).toBe('Star it');
  });

  it('hides the label text unless showLabel is set', () => {
    renderTools([tool()]);
    expect(screen.queryByText('Star it')).toBeNull();

    renderTools([tool({ id: 'b', showLabel: true })]);
    expect(screen.getByText('Star it')).toBeTruthy();
  });

  it('renders an icon component at the toolbar icon size', () => {
    renderTools([tool()]);
    expect(screen.getByTestId('star-icon').getAttribute('width')).toBe('16');
  });

  it('renders an icon supplied as an element', () => {
    renderTools([tool({ icon: <span data-testid="element-icon">*</span> })]);
    expect(screen.getByTestId('element-icon')).toBeTruthy();
  });

  it('renders a memoized icon component as a component, not as a child', () => {
    const MemoIcon = memo(StarIcon);
    renderTools([tool({ icon: MemoIcon })]);
    expect(screen.getByTestId('star-icon')).toBeTruthy();
  });
});

describe('ToolsSection — Interaction', () => {
  it('calls onClick with the viewer API and its own button element', () => {
    const onClick = vi.fn();
    renderTools([tool({ onClick })]);

    const button = screen.getByRole('button', { name: 'Star it' });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    const context = onClick.mock.calls[0][0];
    expect(context.viewer).toBe(viewer);
    expect(context.element).toBe(button);
  });

  it('passes a snapshot of the viewer state', () => {
    const onClick = vi.fn();
    renderTools([tool({ onClick })]);

    fireEvent.click(screen.getByRole('button', { name: 'Star it' }));

    const context = onClick.mock.calls[0][0];
    expect(context).toMatchObject({
      fileName: null,
      sheetNames: [],
      activeSheet: null,
      sheetData: null,
      selection: [],
      activeCell: null,
      zoom: 1,
      mode: 'view',
    });
  });

  it('disables a tool whose isDisabled returns true, and does not fire it', () => {
    const onClick = vi.fn();
    renderTools([tool({ onClick, isDisabled: () => true })]);

    const button = screen.getByRole('button', { name: 'Star it' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('marks an active tool as pressed', () => {
    renderTools([tool({ isActive: () => true })]);

    const button = screen.getByRole('button', { name: 'Star it' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.className).toContain('active');
  });

  it('leaves aria-pressed off tools that declare no active state', () => {
    renderTools([tool()]);
    expect(screen.getByRole('button', { name: 'Star it' }).getAttribute('aria-pressed')).toBeNull();
  });

  it('runs a configured tool with its bound config', () => {
    const onClick = vi.fn();
    const configured = defineSheetViewerTool({
      id: 'export',
      label: 'Export',
      icon: StarIcon,
      config: { format: 'csv' as const },
      onClick,
    });

    renderTools([configured]);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    expect(onClick).toHaveBeenCalledWith(expect.anything(), { format: 'csv' });
  });
});
