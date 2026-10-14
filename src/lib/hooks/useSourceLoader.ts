import { useState, useEffect, useRef } from 'react';
import type { SheetViewerSource } from '../types';
import { DEFAULT_SHEET_LIMITS, FileTooLargeError } from '../utils/sheetBounds';

export interface SourceLoaderState {
  buffer: ArrayBuffer | null;
  fileName: string | null;
  isLoading: boolean;
  error: string | null;
  /** The error behind `error`, for consumers that want the object itself. */
  cause: Error | null;
}

/**
 * Normalizes a `source` prop (URL string | ArrayBuffer | File | ArrayBufferView)
 * into { buffer, fileName, isLoading, error }.
 *
 * Re-runs when `source` changes.
 * NOTE: No manual ref-deduplication — React's dependency array handles that,
 * and using a ref would break under StrictMode's double-fire semantics.
 *
 * A source over `maxBytes` fails with `FileTooLargeError` before it is read:
 * a File by its size, a URL by its declared Content-Length (then by what was
 * downloaded), a buffer by its length. `maxBytes` is read when a source
 * loads; changing it does not reload the current one.
 */
export function useSourceLoader(
  source: SheetViewerSource | undefined,
  maxBytes: number = DEFAULT_SHEET_LIMITS.maxBytes,
): SourceLoaderState {
  const maxBytesRef = useRef(maxBytes);
  maxBytesRef.current = maxBytes;

  const [state, setState] = useState<SourceLoaderState>({
    buffer: null,
    fileName: null,
    isLoading: false,
    error: null,
    cause: null,
  });

  useEffect(() => {
    if (!source) {
      setState({ buffer: null, fileName: null, isLoading: false, error: null, cause: null });
      return;
    }

    let cancelled = false;

    setState({ buffer: null, fileName: null, isLoading: true, error: null, cause: null });

    async function load() {
      const limit = maxBytesRef.current;
      const checkSize = (byteLength: number) => {
        if (byteLength > limit) throw new FileTooLargeError();
      };

      try {
        let buffer: ArrayBuffer;
        let fileName: string;

        if (typeof source === 'string') {
          // URL string
          fileName = source.split('/').pop()?.split('?')[0] || 'spreadsheet.xlsx';
          const response = await fetch(source);
          if (!response.ok) throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
          const declared = Number(response.headers?.get('content-length'));
          if (Number.isFinite(declared) && declared > limit) {
            response.body?.cancel().catch(() => undefined);
            throw new FileTooLargeError();
          }
          buffer = await response.arrayBuffer();
        } else if (source instanceof File) {
          // File object
          fileName = source.name;
          checkSize(source.size);
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

        checkSize(buffer.byteLength);

        if (!cancelled) {
          setState({ buffer, fileName, isLoading: false, error: null, cause: null });
        }
      } catch (err) {
        if (!cancelled) {
          const cause = err instanceof Error ? err : new Error(String(err));
          setState({ buffer: null, fileName: null, isLoading: false, error: cause.message, cause });
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
