import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { useSourceLoader } from '../useSourceLoader';
import { FileTooLargeError, FILE_TOO_LARGE_MESSAGE } from '../../utils/sheetBounds';

// Simple renderHook for React 17 (RTL v12 doesn't export renderHook)
function renderHook<T>(hook: () => T) {
  const result = { current: null as T };
  function TestComponent() {
    result.current = hook();
    return null;
  }
  const utils = render(React.createElement(TestComponent));
  return { result, ...utils };
}

describe('useSourceLoader', () => {
  it('returns initial state when no source', () => {
    const { result } = renderHook(() => useSourceLoader(undefined));
    expect(result.current.buffer).toBeNull();
    expect(result.current.fileName).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('loads a File source', async () => {
    const content = 'Name,Age\nAlice,30\n';
    const file = new File([content], 'test.csv', { type: 'text/csv' });

    const { result } = renderHook(() => useSourceLoader(file));

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.buffer).not.toBeNull();
      },
      { timeout: 5000 }
    );

    expect(result.current.buffer).toBeInstanceOf(ArrayBuffer);
    expect(result.current.fileName).toBe('test.csv');
    expect(result.current.error).toBeNull();
  });

  it('loads an ArrayBuffer source', async () => {
    const buffer = new ArrayBuffer(5);
    const view = new Uint8Array(buffer);
    view.set([104, 101, 108, 108, 111]); // "hello"

    const { result } = renderHook(() => useSourceLoader(buffer));

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.buffer).not.toBeNull();
      },
      { timeout: 5000 }
    );

    expect(result.current.buffer).toBe(buffer);
    expect(result.current.fileName).toBe('spreadsheet.xlsx');
    expect(result.current.error).toBeNull();
  });

  it('loads a Uint8Array source', async () => {
    const typed = new Uint8Array([1, 2, 3, 4]);

    const { result } = renderHook(() => useSourceLoader(typed));

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.buffer).not.toBeNull();
      },
      { timeout: 5000 }
    );

    expect(result.current.buffer).toBeInstanceOf(ArrayBuffer);
    expect(result.current.fileName).toBe('spreadsheet.xlsx');
    expect(result.current.error).toBeNull();
    const view = new Uint8Array(result.current.buffer!);
    expect(Array.from(view)).toEqual([1, 2, 3, 4]);
  });
});

describe('useSourceLoader — maxBytes', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const settled = async (result: { current: ReturnType<typeof useSourceLoader> }) => {
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });
  };

  it('refuses a File over the limit without reading it', async () => {
    const file = new File(['0123456789'], 'big.xlsx');
    const read = vi.spyOn(file, 'arrayBuffer');

    const { result } = renderHook(() => useSourceLoader(file, 9));
    await settled(result);

    expect(result.current.buffer).toBeNull();
    expect(result.current.error).toBe(FILE_TOO_LARGE_MESSAGE);
    expect(result.current.cause).toBeInstanceOf(FileTooLargeError);
    expect(read).not.toHaveBeenCalled();
  });

  it('loads a File exactly at the limit', async () => {
    const file = new File(['0123456789'], 'ok.csv');
    const { result } = renderHook(() => useSourceLoader(file, 10));
    await settled(result);

    expect(result.current.error).toBeNull();
    expect(result.current.buffer!.byteLength).toBe(10);
  });

  it('refuses a buffer over the limit', async () => {
    // Created once: a new buffer on every render would be a new source each time.
    const buffer = new ArrayBuffer(11);
    const { result } = renderHook(() => useSourceLoader(buffer, 10));
    await settled(result);

    expect(result.current.cause).toBeInstanceOf(FileTooLargeError);
  });

  it('refuses a URL whose declared size is over the limit before downloading it', async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(1));
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'content-length': '11' }),
      body: { cancel: async () => undefined },
      arrayBuffer,
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useSourceLoader('https://example.test/big.xlsx', 10));
    await settled(result);

    expect(result.current.cause).toBeInstanceOf(FileTooLargeError);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('refuses a URL without a declared size once the download is over the limit', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      headers: new Headers(),
      arrayBuffer: async () => new ArrayBuffer(11),
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useSourceLoader('https://example.test/big.xlsx', 10));
    await settled(result);

    expect(result.current.cause).toBeInstanceOf(FileTooLargeError);
    expect(result.current.buffer).toBeNull();
  });

  it('defaults to 50 MB', async () => {
    const buffer = new ArrayBuffer(50 * 1024 * 1024 + 1);
    const { result } = renderHook(() => useSourceLoader(buffer));
    await settled(result);

    expect(result.current.cause).toBeInstanceOf(FileTooLargeError);
  });
});
