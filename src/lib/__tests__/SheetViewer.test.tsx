import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import { createRef } from 'react';
import { SheetViewer } from '../index';
import type { SheetViewerHandle } from '../types';

// Mock requestAnimationFrame to resolve immediately in jsdom
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function createCsvFile(content: string, name = 'test.csv'): File {
  return new File([content], name, { type: 'text/csv' });
}

const sampleCsv = `Name,Age,City
Alice,30,NYC
Bob,25,SF`;

describe('SheetViewer', () => {
  it('renders empty state when no source', () => {
    render(<SheetViewer height={400} width={600} />);
    expect(screen.getByText('No source provided')).toBeTruthy();
  });

  it('renders loading and then data when given a CSV file source', async () => {
    const file = createCsvFile(sampleCsv);
    render(<SheetViewer source={file} height={600} width={800} />);

    await waitFor(
      () => {
        expect(screen.queryByText('No source provided')).toBeNull();
      },
      { timeout: 5000 }
    );
  });

  it('exposes sheet data via ref handle', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);

    await waitFor(
      () => {
        expect(ref.current?.getSheetNames().length).toBeGreaterThan(0);
      },
      { timeout: 10000 }
    );

    expect(ref.current?.getSheetNames()).toEqual(['Sheet1']);
    expect(ref.current?.getActiveSheet()).toBe('Sheet1');
    expect(ref.current?.getFileName()).toBe('test.csv');

    const data = ref.current?.getSheetData();
    expect(data).not.toBeNull();
    expect(data!.rows).toBe(3);
    expect(data!.cols).toBe(3);
    expect(data!.data[0]).toEqual(['Name', 'Age', 'City']);
    expect(data!.data[1]).toEqual(['Alice', '30', 'NYC']);
  }, 15000);

  it('respects mode prop', async () => {
    const file = createCsvFile(sampleCsv);
    const { rerender } = render(
      <SheetViewer source={file} mode="view" height={600} width={800} />
    );

    await waitFor(
      () => {
        expect(screen.queryByText('No source provided')).toBeNull();
      },
      { timeout: 5000 }
    );

    // Rerender in edit mode -- should not crash
    rerender(
      <SheetViewer source={file} mode="edit" height={600} width={800} />
    );
  });

  it('ref.setHighlight programmatically sets highlight', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);

    await waitFor(
      () => {
        expect(ref.current?.getSheetNames().length).toBeGreaterThan(0);
      },
      { timeout: 10000 }
    );

    // Should not throw
    ref.current?.setHighlight('A1:B2');
  }, 15000);
});
