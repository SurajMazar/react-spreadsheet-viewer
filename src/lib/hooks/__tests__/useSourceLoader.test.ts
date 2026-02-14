import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { useSourceLoader } from '../useSourceLoader';

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
