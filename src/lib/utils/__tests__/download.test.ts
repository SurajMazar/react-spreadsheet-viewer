import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadAsCsv } from '../download';
import type { SheetData } from '../../types';

// Mock URL.createObjectURL and URL.revokeObjectURL
beforeEach(() => {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
});

const mockSheet: SheetData = {
  data: [
    ['Name', 'Age', 'City'],
    ['Alice', 30, 'NYC'],
    ['Bob', 25, 'SF'],
  ],
  rows: 3,
  cols: 3,
  merges: [],
  colWidths: [100, 100, 100],
};

// =============================================
// downloadAsCsv
// =============================================
describe('downloadAsCsv', () => {
  it('creates a CSV blob and triggers download', () => {
    const mockClick = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
      set setAttribute(_args: unknown) {},
    } as unknown as HTMLAnchorElement);

    downloadAsCsv(mockSheet, 'TestSheet');

    expect(mockClick).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('does nothing when sheetData is null', () => {
    const mockClick = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
    } as unknown as HTMLAnchorElement);

    downloadAsCsv(null, 'Sheet1');
    expect(mockClick).not.toHaveBeenCalled();
  });

  it('escapes cells containing commas', () => {
    const sheet: SheetData = {
      data: [['Hello, World']],
      rows: 1, cols: 1, merges: [], colWidths: [100],
    };

    let capturedContent = '';
    const OrigBlob = globalThis.Blob;
    vi.stubGlobal('Blob', class MockBlob {
      constructor(parts: string[]) {
        capturedContent = parts[0];
      }
    });

    const mockClick = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '', download: '', click: mockClick,
    } as unknown as HTMLAnchorElement);

    downloadAsCsv(sheet, 'Sheet1');
    expect(capturedContent).toBe('"Hello, World"');

    vi.stubGlobal('Blob', OrigBlob);
  });

  it('escapes cells containing double quotes', () => {
    const sheet: SheetData = {
      data: [['She said "hi"']],
      rows: 1, cols: 1, merges: [], colWidths: [100],
    };

    let capturedContent = '';
    const OrigBlob = globalThis.Blob;
    vi.stubGlobal('Blob', class MockBlob {
      constructor(parts: string[]) {
        capturedContent = parts[0];
      }
    });

    const mockClick = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '', download: '', click: mockClick,
    } as unknown as HTMLAnchorElement);

    downloadAsCsv(sheet, 'Sheet1');
    expect(capturedContent).toBe('"She said ""hi"""');

    vi.stubGlobal('Blob', OrigBlob);
  });

  it('escapes cells containing newlines', () => {
    const sheet: SheetData = {
      data: [['line1\nline2']],
      rows: 1, cols: 1, merges: [], colWidths: [100],
    };

    let capturedContent = '';
    const OrigBlob = globalThis.Blob;
    vi.stubGlobal('Blob', class MockBlob {
      constructor(parts: string[]) {
        capturedContent = parts[0];
      }
    });

    const mockClick = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '', download: '', click: mockClick,
    } as unknown as HTMLAnchorElement);

    downloadAsCsv(sheet, 'Sheet1');
    expect(capturedContent).toBe('"line1\nline2"');

    vi.stubGlobal('Blob', OrigBlob);
  });

  it('handles null cell values as empty string', () => {
    const sheet: SheetData = {
      data: [['A', null, 'C']],
      rows: 1, cols: 3, merges: [], colWidths: [100, 100, 100],
    };

    let capturedContent = '';
    const OrigBlob = globalThis.Blob;
    vi.stubGlobal('Blob', class MockBlob {
      constructor(parts: string[]) {
        capturedContent = parts[0];
      }
    });

    const mockClick = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '', download: '', click: mockClick,
    } as unknown as HTMLAnchorElement);

    downloadAsCsv(sheet, 'Sheet1');
    expect(capturedContent).toBe('A,,C');

    vi.stubGlobal('Blob', OrigBlob);
  });

  it('uses sheet name for download filename', () => {
    let capturedDownload = '';
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      set download(v: string) { capturedDownload = v; },
      get download() { return capturedDownload; },
      click: vi.fn(),
    } as unknown as HTMLAnchorElement);

    downloadAsCsv(mockSheet, 'Revenue');
    expect(capturedDownload).toBe('Revenue.csv');
  });

  it('falls back to "sheet.csv" when sheetName is null', () => {
    let capturedDownload = '';
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      set download(v: string) { capturedDownload = v; },
      get download() { return capturedDownload; },
      click: vi.fn(),
    } as unknown as HTMLAnchorElement);

    downloadAsCsv(mockSheet, null);
    expect(capturedDownload).toBe('sheet.csv');
  });
});
