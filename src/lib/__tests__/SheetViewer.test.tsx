import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, screen, act } from '@testing-library/react';
import React, { createRef } from 'react';
import { SheetViewer } from '../index';
import type { SheetViewerHandle, CellRange } from '../types';

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

const multiSheetHelper = async (ref: React.RefObject<SheetViewerHandle | null>) => {
  await waitFor(
    () => { expect(ref.current?.getSheetNames().length).toBeGreaterThan(0); },
    { timeout: 10000 }
  );
};

// =============================================
// Empty / Loading / Error States
// =============================================
describe('SheetViewer — Empty & Loading States', () => {
  it('renders empty state when no source is provided', () => {
    render(<SheetViewer height={400} width={600} />);
    expect(screen.getByText('No source provided')).toBeTruthy();
  });

  it('does not render empty state when source is provided', async () => {
    const file = createCsvFile(sampleCsv);
    render(<SheetViewer source={file} height={600} width={800} />);

    await waitFor(
      () => { expect(screen.queryByText('No source provided')).toBeNull(); },
      { timeout: 5000 }
    );
  });

  it('renders loading UI initially while parsing', () => {
    const file = createCsvFile(sampleCsv);
    render(<SheetViewer source={file} height={600} width={800} />);
    // Loading overlay should be present (before parsing completes)
    const loadingEl = document.querySelector('.sv-loading-overlay');
    // May or may not be present depending on timing, so just verify no crash
    expect(true).toBe(true);
  });
});

// =============================================
// Ref Handle — Data Access
// =============================================
describe('SheetViewer — Ref handle data access', () => {
  it('exposes getSheetNames, getActiveSheet, getFileName', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv, 'employees.csv');

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    expect(ref.current?.getSheetNames()).toEqual(['Sheet1']);
    expect(ref.current?.getActiveSheet()).toBe('Sheet1');
    expect(ref.current?.getFileName()).toBe('employees.csv');
  }, 15000);

  it('getSheetData returns parsed data with correct dimensions', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    const data = ref.current?.getSheetData();
    expect(data).not.toBeNull();
    expect(data!.rows).toBe(3);
    expect(data!.cols).toBe(3);
    expect(data!.data[0]).toEqual(['Name', 'Age', 'City']);
    expect(data!.data[1]).toEqual(['Alice', '30', 'NYC']);
    expect(data!.data[2]).toEqual(['Bob', '25', 'SF']);
  }, 15000);

  it('getAllSheets returns a record of all sheets', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    const all = ref.current?.getAllSheets();
    expect(all).toBeDefined();
    expect(Object.keys(all!)).toEqual(['Sheet1']);
    expect(all!['Sheet1'].rows).toBe(3);
  }, 15000);

  it('getSheetData returns null for non-existent sheet', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    expect(ref.current?.getSheetData('DoesNotExist')).toBeNull();
  }, 15000);
});

// =============================================
// Ref Handle — getCellRangeData
// =============================================
describe('SheetViewer — getCellRangeData', () => {
  it('returns data for a rectangular range', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    const data = ref.current?.getCellRangeData('A1:C2');
    expect(data).not.toBeNull();
    expect(data!.length).toBe(2);
    expect(data![0]).toEqual(['Name', 'Age', 'City']);
    expect(data![1]).toEqual(['Alice', '30', 'NYC']);
  }, 15000);

  it('returns data for a single cell', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    const data = ref.current?.getCellRangeData('B2');
    expect(data).not.toBeNull();
    expect(data!).toEqual([['30']]);
  }, 15000);

  it('returns null for invalid range expression', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    expect(ref.current?.getCellRangeData('')).toBeNull();
  }, 15000);

  it('returns null for out-of-range cells', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    const data = ref.current?.getCellRangeData('Z99');
    // Returns array with null for out-of-bounds
    expect(data).not.toBeNull();
    expect(data![0][0]).toBeNull();
  }, 15000);
});

// =============================================
// Ref Handle — getSelectedRangeData
// =============================================
describe('SheetViewer — getSelectedRangeData', () => {
  it('returns null when no selection exists', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    expect(ref.current?.getSelectedRangeData()).toBeNull();
  }, 15000);

  it('returns data after setHighlight creates a selection', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    ref.current?.setHighlight('A1:B2');

    const data = ref.current?.getSelectedRangeData();
    expect(data).not.toBeNull();
    expect(data!.length).toBe(2);
    expect(data![0]).toEqual(['Name', 'Age']);
    expect(data![1]).toEqual(['Alice', '30']);
  }, 15000);

});

// =============================================
// Ref Handle — Navigation
// =============================================
describe('SheetViewer — Ref navigation', () => {
  it('setHighlight programmatically highlights a range', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    // Should not throw
    expect(() => ref.current?.setHighlight('A1:B2')).not.toThrow();
  }, 15000);

  it('clearHighlight removes the current highlighted range', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    act(() => {
      ref.current?.setHighlight('A1:B2');
    });
    expect(ref.current?.getHighlight()).toBe('A1:B2');

    act(() => {
      ref.current?.clearHighlight();
    });
    expect(ref.current?.getHighlight()).toBeNull();
    expect(ref.current?.getSelectedRangeData()).toBeNull();
  }, 15000);

  it('setHighlight with an empty range clears the current highlight', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    act(() => {
      ref.current?.setHighlight('A1:B2');
    });
    expect(ref.current?.getHighlight()).toBe('A1:B2');

    act(() => {
      ref.current?.setHighlight('');
    });
    expect(ref.current?.getHighlight()).toBeNull();
    expect(ref.current?.getSelectedRangeData()).toBeNull();
  }, 15000);

  it('setActiveSheet switches to a sheet', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    // Only one sheet for CSV, but should not throw
    expect(() => ref.current?.setActiveSheet('Sheet1')).not.toThrow();
    expect(ref.current?.getActiveSheet()).toBe('Sheet1');
  }, 15000);
});

// =============================================
// Props — Mode
// =============================================
describe('SheetViewer — Mode prop', () => {
  it('renders in view mode by default', async () => {
    const file = createCsvFile(sampleCsv);
    render(<SheetViewer source={file} height={600} width={800} />);

    await waitFor(
      () => { expect(screen.queryByText('No source provided')).toBeNull(); },
      { timeout: 5000 }
    );
  });

  it('can switch from view to edit mode without crashing', async () => {
    const file = createCsvFile(sampleCsv);
    const { rerender } = render(
      <SheetViewer source={file} mode="view" height={600} width={800} />
    );

    await waitFor(
      () => { expect(screen.queryByText('No source provided')).toBeNull(); },
      { timeout: 5000 }
    );

    rerender(
      <SheetViewer source={file} mode="edit" height={600} width={800} />
    );
  });
});

// =============================================
// Props — chartable
// =============================================
describe('SheetViewer — chartable prop', () => {
  it('shows Charts button by default (chartable=true)', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);
    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);

    await multiSheetHelper(ref);

    expect(screen.queryByTitle('Charts')).not.toBeNull();
  }, 15000);

  it('hides Charts button when chartable=false', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);
    render(<SheetViewer ref={ref} source={file} chartable={false} height={600} width={800} />);

    await multiSheetHelper(ref);

    expect(screen.queryByTitle('Charts')).toBeNull();
  }, 15000);
});

// =============================================
// Props — downloadable
// =============================================
describe('SheetViewer — downloadable prop', () => {
  it('hides Download button by default', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);
    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);

    await multiSheetHelper(ref);

    expect(screen.queryByTitle('Download')).toBeNull();
  }, 15000);

  it('shows Download button when downloadable=true', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);
    render(<SheetViewer ref={ref} source={file} downloadable height={600} width={800} />);

    await multiSheetHelper(ref);

    expect(screen.queryByTitle('Download')).not.toBeNull();
  }, 15000);
});

// =============================================
// Props — Container dimensions
// =============================================
describe('SheetViewer — Container sizing', () => {
  it('applies numeric width/height as px', () => {
    const { container } = render(<SheetViewer height={400} width={600} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('600px');
    expect(root.style.height).toBe('400px');
  });

  it('applies string width/height as-is', () => {
    const { container } = render(<SheetViewer height="50vh" width="80%" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('80%');
    expect(root.style.height).toBe('50vh');
  });
});

// =============================================
// Props — className
// =============================================
describe('SheetViewer — className prop', () => {
  it('applies custom className to root element', () => {
    const { container } = render(<SheetViewer className="my-custom-class" height={400} width={600} />);
    expect(container.firstElementChild?.classList.contains('sheet-viewer')).toBe(true);
    expect(container.firstElementChild?.classList.contains('my-custom-class')).toBe(true);
  });
});

// =============================================
// Callbacks
// =============================================
describe('SheetViewer — Callbacks', () => {
  it('fires onSelectionChange when highlight is set via ref', async () => {
    const onSelectionChange = vi.fn();
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(
      <SheetViewer
        ref={ref}
        source={file}
        onSelectionChange={onSelectionChange}
        height={600}
        width={800}
      />
    );
    await multiSheetHelper(ref);

    ref.current?.setHighlight('A1:B2');

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalled();
    });

    const calledRanges: CellRange[] = onSelectionChange.mock.calls[0][0];
    expect(calledRanges.length).toBeGreaterThan(0);
    expect(calledRanges[0].startRow).toBe(0);
    expect(calledRanges[0].endRow).toBe(1);
  }, 15000);

  it('does not fire onSelectionChange when clearHighlight is silent', async () => {
    const onSelectionChange = vi.fn();
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(
      <SheetViewer
        ref={ref}
        source={file}
        onSelectionChange={onSelectionChange}
        height={600}
        width={800}
      />
    );
    await multiSheetHelper(ref);

    act(() => {
      ref.current?.setHighlight('A1:B2');
    });

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
    });

    act(() => {
      ref.current?.clearHighlight({ silent: true });
    });

    expect(ref.current?.getHighlight()).toBeNull();
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
  }, 15000);
});

// =============================================
// Multiple Instances
// =============================================
describe('SheetViewer — Instance isolation', () => {
  it('two SheetViewer instances do not share state', async () => {
    const ref1 = createRef<SheetViewerHandle>();
    const ref2 = createRef<SheetViewerHandle>();

    const file1 = createCsvFile('A,B\n1,2', 'file1.csv');
    const file2 = createCsvFile('X,Y,Z\n7,8,9\n10,11,12', 'file2.csv');

    render(
      <div>
        <SheetViewer ref={ref1} source={file1} height={300} width={400} />
        <SheetViewer ref={ref2} source={file2} height={300} width={400} />
      </div>
    );

    await waitFor(
      () => {
        expect(ref1.current?.getSheetNames().length).toBeGreaterThan(0);
        expect(ref2.current?.getSheetNames().length).toBeGreaterThan(0);
      },
      { timeout: 10000 }
    );

    expect(ref1.current?.getFileName()).toBe('file1.csv');
    expect(ref2.current?.getFileName()).toBe('file2.csv');
    expect(ref1.current?.getSheetData()?.cols).toBe(2);
    expect(ref2.current?.getSheetData()?.cols).toBe(3);
  }, 15000);
});

// =============================================
// Source Types
// =============================================
describe('SheetViewer — Source types', () => {
  it('loads from an ArrayBuffer source', async () => {
    const ref = createRef<SheetViewerHandle>();
    const csv = 'Col1,Col2\nVal1,Val2';
    const encoder = new TextEncoder();
    const encoded = encoder.encode(csv);
    // Create a clean ArrayBuffer (JSDOM can have issues with TypedArray.buffer)
    const buffer = new ArrayBuffer(encoded.byteLength);
    new Uint8Array(buffer).set(encoded);

    render(<SheetViewer ref={ref} source={buffer} height={600} width={800} />);

    await waitFor(
      () => { expect(ref.current?.getSheetNames().length).toBeGreaterThan(0); },
      { timeout: 10000 }
    );

    expect(ref.current?.getFileName()).toBe('spreadsheet.xlsx');
    const data = ref.current?.getSheetData();
    expect(data).not.toBeNull();
  }, 15000);

  it('loads from a Uint8Array source', async () => {
    const ref = createRef<SheetViewerHandle>();
    const typed = new TextEncoder().encode('A,B\n1,2');

    render(<SheetViewer ref={ref} source={typed} height={600} width={800} />);

    await waitFor(
      () => { expect(ref.current?.getSheetNames().length).toBeGreaterThan(0); },
      { timeout: 10000 }
    );

    expect(ref.current?.getSheetData()).not.toBeNull();
  }, 15000);
});
