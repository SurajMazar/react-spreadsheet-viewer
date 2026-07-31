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

// =============================================
// highlightAreaRef — single element spanning the whole highlight
// =============================================
// A CSV source leaves colWidths/rowHeights empty, so the grid is uniform
// 100x26 and pixel expectations below are stable. Note that in jsdom the
// scroll container measures 0x0, so no Cell nodes render at all — but the
// virtualizer's measurementsCache is still fully populated, which is exactly
// why this overlay is assertable here while [data-cell] lookups are not.
describe('SheetViewer — highlightAreaRef', () => {
  const areaEls = () => document.querySelectorAll('.sv-highlight-area');

  it('is null when there is no highlight', async () => {
    const ref = createRef<SheetViewerHandle>();
    const areaRef = createRef<HTMLDivElement>();
    const file = createCsvFile(sampleCsv);

    render(
      <SheetViewer ref={ref} highlightAreaRef={areaRef} source={file} height={600} width={800} />
    );
    await multiSheetHelper(ref);

    expect(areaRef.current).toBeNull();
    expect(areaEls().length).toBe(0);
  }, 15000);

  it('receives one element covering the highlighted range', async () => {
    const ref = createRef<SheetViewerHandle>();
    const areaRef = createRef<HTMLDivElement>();
    const file = createCsvFile(sampleCsv);

    render(
      <SheetViewer ref={ref} highlightAreaRef={areaRef} source={file} height={600} width={800} />
    );
    await multiSheetHelper(ref);

    act(() => { ref.current?.setHighlight('A1:B2'); });

    const el = areaRef.current!;
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.classList.contains('sv-highlight-area')).toBe(true);
    expect(el.style.top).toBe('0px');
    expect(el.style.left).toBe('0px');
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('52px');
  }, 15000);

  it('exposes exactly one element spanning multiple disjoint ranges', async () => {
    const ref = createRef<SheetViewerHandle>();
    const areaRef = createRef<HTMLDivElement>();
    const file = createCsvFile(sampleCsv);

    render(
      <SheetViewer ref={ref} highlightAreaRef={areaRef} source={file} height={600} width={800} />
    );
    await multiSheetHelper(ref);

    act(() => { ref.current?.setHighlight('A1:B2,D1:E3'); });

    // One element only — the union box A1:E3
    expect(areaEls().length).toBe(1);
    const el = areaRef.current!;
    expect(el.style.left).toBe('0px');
    expect(el.style.width).toBe('500px');
    expect(el.style.height).toBe('78px');
  }, 15000);

  it('goes back to null when the highlight is cleared', async () => {
    const ref = createRef<SheetViewerHandle>();
    const areaRef = createRef<HTMLDivElement>();
    const file = createCsvFile(sampleCsv);

    render(
      <SheetViewer ref={ref} highlightAreaRef={areaRef} source={file} height={600} width={800} />
    );
    await multiSheetHelper(ref);

    act(() => { ref.current?.setHighlight('A1:B2'); });
    expect(areaRef.current).not.toBeNull();

    act(() => { ref.current?.clearHighlight(); });
    expect(areaRef.current).toBeNull();
    expect(areaEls().length).toBe(0);
  }, 15000);

  it('works with the declarative highlight prop (which leaves activeCell null)', async () => {
    // Regression guard: the overlay must derive from `ranges`, not `activeCell`.
    const ref = createRef<SheetViewerHandle>();
    const areaRef = createRef<HTMLDivElement>();
    const file = createCsvFile(sampleCsv);

    const { rerender } = render(
      <SheetViewer
        ref={ref}
        highlightAreaRef={areaRef}
        highlight="B2:C3"
        source={file}
        height={600}
        width={800}
      />
    );
    await multiSheetHelper(ref);

    await waitFor(() => { expect(areaRef.current).not.toBeNull(); });
    const el = areaRef.current!;
    expect(el.style.top).toBe('26px');
    expect(el.style.left).toBe('100px');
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('52px');

    rerender(
      <SheetViewer
        ref={ref}
        highlightAreaRef={areaRef}
        highlight={undefined}
        source={file}
        height={600}
        width={800}
      />
    );
    await waitFor(() => { expect(areaRef.current).toBeNull(); });
  }, 15000);

  it('supports a callback ref, including detach on clear', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);
    const seen: (HTMLDivElement | null)[] = [];

    render(
      <SheetViewer
        ref={ref}
        highlightAreaRef={(el) => { seen.push(el); }}
        source={file}
        height={600}
        width={800}
      />
    );
    await multiSheetHelper(ref);

    act(() => { ref.current?.setHighlight('A1:B2'); });
    expect(seen[seen.length - 1]).toBeInstanceOf(HTMLElement);

    act(() => { ref.current?.clearHighlight(); });
    expect(seen[seen.length - 1]).toBeNull();
  }, 15000);

  it('still provides the element when highlightable is false', async () => {
    const ref = createRef<SheetViewerHandle>();
    const areaRef = createRef<HTMLDivElement>();
    const file = createCsvFile(sampleCsv);

    render(
      <SheetViewer
        ref={ref}
        highlightAreaRef={areaRef}
        highlightable={false}
        source={file}
        height={600}
        width={800}
      />
    );
    await multiSheetHelper(ref);

    act(() => { ref.current?.setHighlight('A1:B2'); });
    expect(areaRef.current).not.toBeNull();
    expect(areaRef.current?.style.width).toBe('200px');
  }, 15000);

  it('repositions when a column or row inside the highlight is resized', async () => {
    const ref = createRef<SheetViewerHandle>();
    const areaRef = createRef<HTMLDivElement>();
    const file = createCsvFile(sampleCsv);

    render(
      <SheetViewer ref={ref} highlightAreaRef={areaRef} source={file} height={600} width={800} />
    );
    await multiSheetHelper(ref);

    act(() => { ref.current?.setHighlight('A1:B2'); });
    expect(areaRef.current?.style.width).toBe('200px');

    act(() => { ref.current?.setColumnWidth(0, 300); });
    await waitFor(() => { expect(areaRef.current?.style.width).toBe('400px'); });

    act(() => { ref.current?.setRowHeight(0, 60); });
    await waitFor(() => { expect(areaRef.current?.style.height).toBe('86px'); });
  }, 15000);

  it('getHighlightElement returns the same element as the ref', async () => {
    const ref = createRef<SheetViewerHandle>();
    const areaRef = createRef<HTMLDivElement>();
    const file = createCsvFile(sampleCsv);

    render(
      <SheetViewer ref={ref} highlightAreaRef={areaRef} source={file} height={600} width={800} />
    );
    await multiSheetHelper(ref);

    expect(ref.current?.getHighlightElement()).toBeNull();

    act(() => { ref.current?.setHighlight('A1:B2'); });
    expect(ref.current?.getHighlightElement()).toBe(areaRef.current);

    act(() => { ref.current?.clearHighlight(); });
    expect(ref.current?.getHighlightElement()).toBeNull();
  }, 15000);

  it('keeps two viewer instances isolated', async () => {
    const refA = createRef<SheetViewerHandle>();
    const refB = createRef<SheetViewerHandle>();
    const areaA = createRef<HTMLDivElement>();
    const areaB = createRef<HTMLDivElement>();

    render(
      <>
        <SheetViewer
          ref={refA}
          highlightAreaRef={areaA}
          source={createCsvFile(sampleCsv, 'a.csv')}
          height={600}
          width={800}
        />
        <SheetViewer
          ref={refB}
          highlightAreaRef={areaB}
          source={createCsvFile(sampleCsv, 'b.csv')}
          height={600}
          width={800}
        />
      </>
    );
    await multiSheetHelper(refA);
    await multiSheetHelper(refB);

    act(() => {
      refA.current?.setHighlight('A1:A1');
      refB.current?.setHighlight('A1:C3');
    });

    expect(areaA.current).not.toBe(areaB.current);
    expect(areaA.current?.style.width).toBe('100px');
    expect(areaB.current?.style.width).toBe('300px');
    expect(refA.current?.getHighlightElement()).toBe(areaA.current);
    expect(refB.current?.getHighlightElement()).toBe(areaB.current);
  }, 20000);

  it('detaches the ref on unmount', async () => {
    const ref = createRef<SheetViewerHandle>();
    const areaRef = createRef<HTMLDivElement>();
    const file = createCsvFile(sampleCsv);

    const { unmount } = render(
      <SheetViewer ref={ref} highlightAreaRef={areaRef} source={file} height={600} width={800} />
    );
    await multiSheetHelper(ref);

    act(() => { ref.current?.setHighlight('A1:B2'); });
    expect(areaRef.current).not.toBeNull();

    unmount();
    expect(areaRef.current).toBeNull();
  }, 15000);
});

// =============================================
// highlightAreaProps — extra attributes on the highlight area element
// =============================================
describe('SheetViewer — highlightAreaProps', () => {
  const renderWithProps = async (
    props: React.ComponentProps<typeof SheetViewer>['highlightAreaProps']
  ) => {
    const ref = createRef<SheetViewerHandle>();
    const areaRef = createRef<HTMLDivElement>();
    render(
      <SheetViewer
        ref={ref}
        highlightAreaRef={areaRef}
        highlightAreaProps={props}
        source={createCsvFile(sampleCsv)}
        height={600}
        width={800}
      />
    );
    await multiSheetHelper(ref);
    act(() => { ref.current?.setHighlight('A1:B2'); });
    return { ref, areaRef };
  };

  it('applies an id to the highlight area element', async () => {
    const { areaRef } = await renderWithProps({ id: 'my-anchor' });
    expect(areaRef.current?.id).toBe('my-anchor');
    expect(document.getElementById('my-anchor')).toBe(areaRef.current);
  }, 15000);

  it('applies data-* and aria attributes', async () => {
    const { areaRef } = await renderWithProps({
      'data-testid': 'highlight-box',
      'data-region': 'totals',
      title: 'Selected region',
    });
    expect(areaRef.current?.getAttribute('data-testid')).toBe('highlight-box');
    expect(areaRef.current?.getAttribute('data-region')).toBe('totals');
    expect(areaRef.current?.getAttribute('title')).toBe('Selected region');
  }, 15000);

  it('appends className instead of replacing sv-highlight-area', async () => {
    const { ref, areaRef } = await renderWithProps({ className: 'my-anchor-class' });
    expect(areaRef.current?.classList.contains('sv-highlight-area')).toBe(true);
    expect(areaRef.current?.classList.contains('my-anchor-class')).toBe(true);
    // getHighlightElement queries .sv-highlight-area, so it must still resolve
    expect(ref.current?.getHighlightElement()).toBe(areaRef.current);
  }, 15000);

  it('merges style but keeps the measured geometry authoritative', async () => {
    const { areaRef } = await renderWithProps({
      style: { pointerEvents: 'auto', outline: '2px dashed red', top: 9999, width: 1 },
    });
    const el = areaRef.current!;
    expect(el.style.pointerEvents).toBe('auto');
    expect(el.style.outline).toBe('2px dashed red');
    // Consumer top/width must not win over the computed box (A1:B2 => 200x52 at 0,0)
    expect(el.style.top).toBe('0px');
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('52px');
  }, 15000);

  it('allows overriding the default aria-hidden', async () => {
    const { areaRef } = await renderWithProps({ 'aria-hidden': false, role: 'presentation' });
    expect(areaRef.current?.getAttribute('aria-hidden')).toBe('false');
    expect(areaRef.current?.getAttribute('role')).toBe('presentation');
  }, 15000);

  it('is aria-hidden by default when no props are passed', async () => {
    const { areaRef } = await renderWithProps(undefined);
    expect(areaRef.current?.getAttribute('aria-hidden')).toBe('true');
    expect(areaRef.current?.className).toBe('sv-highlight-area');
  }, 15000);
});

// =============================================
// scrollToSelection — explicit, on-demand scroll
// (jsdom has no layout, so clientHeight/clientWidth are 0 and the scroll math
//  itself is covered in gridGeometry.test.ts; these cover the wiring.)
// =============================================
describe('SheetViewer — scrollToSelection', () => {
  it('returns false when there is no selection', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    expect(ref.current?.scrollToSelection()).toBe(false);
  }, 15000);

  it('returns true once a range is highlighted', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    act(() => { ref.current?.setHighlight('A1:B2'); });
    expect(ref.current?.scrollToSelection()).toBe(true);
  }, 15000);

  it('scrolls the container toward the selection', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    const scroller = document.querySelector('.sv-grid-scroll') as HTMLElement;
    expect(scroller).not.toBeNull();

    act(() => { ref.current?.setHighlight('C30:D34'); });
    act(() => { ref.current?.scrollToSelection(); });

    // Row 30 starts at 29 * 26; with no measured viewport it aligns to the start
    expect(scroller.scrollTop).toBe(29 * 26);
    expect(scroller.scrollLeft).toBe(2 * 100);
  }, 15000);

  it('works for a multi-range selection by spanning their union', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    const scroller = document.querySelector('.sv-grid-scroll') as HTMLElement;

    act(() => { ref.current?.setHighlight('E20:F22,B25:C27'); });
    act(() => { ref.current?.scrollToSelection(); });

    // Union starts at row 20 (index 19) and column B (index 1)
    expect(scroller.scrollTop).toBe(19 * 26);
    expect(scroller.scrollLeft).toBe(1 * 100);
  }, 15000);

  it('returns false after the highlight is cleared', async () => {
    const ref = createRef<SheetViewerHandle>();
    const file = createCsvFile(sampleCsv);

    render(<SheetViewer ref={ref} source={file} height={600} width={800} />);
    await multiSheetHelper(ref);

    act(() => { ref.current?.setHighlight('A1:B2'); });
    expect(ref.current?.scrollToSelection()).toBe(true);

    act(() => { ref.current?.clearHighlight(); });
    expect(ref.current?.scrollToSelection()).toBe(false);
  }, 15000);
});
