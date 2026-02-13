import { useState, useEffect } from 'react';
import type { SheetViewerSource } from '../types';

export interface SourceLoaderState {
  buffer: ArrayBuffer | null;
  fileName: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Normalizes a `source` prop (URL string | ArrayBuffer | File | ArrayBufferView)
 * into { buffer, fileName, isLoading, error }.
 *
 * Re-runs when `source` changes.
 * NOTE: No manual ref-deduplication — React's dependency array handles that,
 * and using a ref would break under StrictMode's double-fire semantics.
 */
export function useSourceLoader(source: SheetViewerSource | undefined): SourceLoaderState {
  const [state, setState] = useState<SourceLoaderState>({
    buffer: null,
    fileName: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!source) {
      setState({ buffer: null, fileName: null, isLoading: false, error: null });
      return;
    }

    let cancelled = false;

    setState({ buffer: null, fileName: null, isLoading: true, error: null });

    async function load() {
      try {
        let buffer: ArrayBuffer;
        let fileName: string;

        if (typeof source === 'string') {
          // URL string
          fileName = source.split('/').pop()?.split('?')[0] || 'spreadsheet.xlsx';
          const response = await fetch(source);
          if (!response.ok) throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
          buffer = await response.arrayBuffer();
        } else if (source instanceof File) {
          // File object
          fileName = source.name;
          buffer = await source.arrayBuffer();
        } else if (source instanceof ArrayBuffer) {
          // Raw ArrayBuffer
          fileName = 'spreadsheet.xlsx';
          buffer = source;
        } else if (ArrayBuffer.isView(source)) {
          // TypedArray or DataView
          fileName = 'spreadsheet.xlsx';
          buffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength) as ArrayBuffer;
        } else {
          throw new Error('Invalid source: expected URL string, File, or ArrayBuffer');
        }

        if (!cancelled) {
          setState({ buffer, fileName, isLoading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({ buffer: null, fileName: null, isLoading: false, error: (err as Error).message });
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [source]);

  return state;
}
