import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useHeaderScrollSync } from '../useHeaderScrollSync';

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

/**
 * The hook samples the scroll offset inside requestAnimationFrame, so the tests
 * drive rAF by hand rather than waiting on real frames.
 */
let frames: Array<() => void>;

function flushFrames(count = 1) {
  for (let i = 0; i < count; i += 1) {
    const due = frames;
    frames = [];
    act(() => {
      due.forEach((fn) => fn());
    });
  }
}

/** A scroll container whose offsets can be moved without a real layout. */
function makeScrollEl() {
  const el = document.createElement('div');
  let left = 0;
  let top = 0;
  Object.defineProperty(el, 'scrollLeft', {
    get: () => left,
    set: (v: number) => {
      left = v;
    },
  });
  Object.defineProperty(el, 'scrollTop', {
    get: () => top,
    set: (v: number) => {
      top = v;
    },
  });
  document.body.appendChild(el);
  return el;
}

function makeHeaderRefs() {
  const col = document.createElement('div');
  const row = document.createElement('div');
  return {
    colRef: { current: col as HTMLElement | null },
    rowRef: { current: row as HTMLElement | null },
    col,
    row,
  };
}

describe('useHeaderScrollSync', () => {
  beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('does nothing when there is no scroll element', () => {
    const { colRef, rowRef, col, row } = makeHeaderRefs();
    const { result } = renderHook(() => useHeaderScrollSync(null, colRef, rowRef));
    act(() => result.current());
    expect(col.style.transform).toBe('');
    expect(row.style.transform).toBe('');
  });

  it('applies the offset already on the container when it attaches', () => {
    const el = makeScrollEl();
    el.scrollLeft = 120;
    el.scrollTop = 40;
    const { colRef, rowRef, col, row } = makeHeaderRefs();

    renderHook(() => useHeaderScrollSync(el, colRef, rowRef));

    // No scroll event has fired — a programmatic scroll or a restored offset
    // must still be picked up.
    expect(col.style.transform).toBe('translate3d(-120px, 0, 0)');
    expect(row.style.transform).toBe('translate3d(0, -40px, 0)');
  });

  it('tracks horizontal scroll on the column headers', () => {
    const el = makeScrollEl();
    const { colRef, rowRef, col, row } = makeHeaderRefs();
    renderHook(() => useHeaderScrollSync(el, colRef, rowRef));

    el.scrollLeft = 250;
    act(() => {
      el.dispatchEvent(new Event('scroll'));
    });
    flushFrames();

    expect(col.style.transform).toBe('translate3d(-250px, 0, 0)');
    expect(row.style.transform).toBe('translate3d(0, 0px, 0)');
  });

  it('tracks vertical scroll on the row headers', () => {
    const el = makeScrollEl();
    const { colRef, rowRef, col, row } = makeHeaderRefs();
    renderHook(() => useHeaderScrollSync(el, colRef, rowRef));

    el.scrollTop = 90;
    act(() => {
      el.dispatchEvent(new Event('scroll'));
    });
    flushFrames();

    expect(row.style.transform).toBe('translate3d(0, -90px, 0)');
    expect(col.style.transform).toBe('translate3d(0px, 0, 0)');
  });

  it('keeps following the offset while no further scroll events arrive', () => {
    // The momentum-scroll case: one event starts the gesture, then the browser
    // moves the container for several frames without dispatching anything else.
    const el = makeScrollEl();
    const { colRef, rowRef, col } = makeHeaderRefs();
    renderHook(() => useHeaderScrollSync(el, colRef, rowRef));

    act(() => {
      el.dispatchEvent(new Event('scroll'));
    });

    for (const offset of [30, 75, 140, 200]) {
      el.scrollLeft = offset;
      flushFrames();
      expect(col.style.transform).toBe(`translate3d(-${offset}px, 0, 0)`);
    }
  });

  it('writes on the scroll event itself, before any frame runs', () => {
    // requestAnimationFrame is starved in a backgrounded tab, a display:none
    // iframe and some embedded webviews. The event-driven write is what keeps
    // the headers correct there.
    const el = makeScrollEl();
    const { colRef, rowRef, col, row } = makeHeaderRefs();
    renderHook(() => useHeaderScrollSync(el, colRef, rowRef));

    el.scrollLeft = 512;
    el.scrollTop = 64;
    act(() => {
      el.dispatchEvent(new Event('scroll'));
    });

    // No flushFrames() — nothing but the listener has run.
    expect(col.style.transform).toBe('translate3d(-512px, 0, 0)');
    expect(row.style.transform).toBe('translate3d(0, -64px, 0)');
  });

  it('catches up on the offset when a hidden tab becomes visible again', () => {
    const el = makeScrollEl();
    const { colRef, rowRef, col } = makeHeaderRefs();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    renderHook(() => useHeaderScrollSync(el, colRef, rowRef));

    // Scrolled while hidden with the frame loop parked.
    el.scrollLeft = 640;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(col.style.transform).toBe('translate3d(0px, 0, 0)');

    hidden.mockReturnValue(false);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(col.style.transform).toBe('translate3d(-640px, 0, 0)');
  });

  it('starts tracking from a wheel gesture even without a scroll event', () => {
    const el = makeScrollEl();
    const { colRef, rowRef, col } = makeHeaderRefs();
    renderHook(() => useHeaderScrollSync(el, colRef, rowRef));

    act(() => {
      el.dispatchEvent(new Event('wheel'));
    });
    el.scrollLeft = 64;
    flushFrames();

    expect(col.style.transform).toBe('translate3d(-64px, 0, 0)');
  });

  it('starts tracking from a touchmove gesture even without a scroll event', () => {
    const el = makeScrollEl();
    const { colRef, rowRef, col } = makeHeaderRefs();
    renderHook(() => useHeaderScrollSync(el, colRef, rowRef));

    act(() => {
      el.dispatchEvent(new Event('touchmove'));
    });
    el.scrollLeft = 15;
    flushFrames();

    expect(col.style.transform).toBe('translate3d(-15px, 0, 0)');
  });

  it('parks the frame loop once the offset stops moving, and restarts on the next event', () => {
    const el = makeScrollEl();
    const { colRef, rowRef, col } = makeHeaderRefs();
    renderHook(() => useHeaderScrollSync(el, colRef, rowRef));

    act(() => {
      el.dispatchEvent(new Event('scroll'));
    });
    el.scrollLeft = 10;
    flushFrames(20);
    expect(frames).toHaveLength(0);

    // A parked loop must not leave the headers behind on the next gesture.
    el.scrollLeft = 300;
    act(() => {
      el.dispatchEvent(new Event('scroll'));
    });
    flushFrames();
    expect(col.style.transform).toBe('translate3d(-300px, 0, 0)');
  });

  it('re-applies the current offset on demand for geometry changes', () => {
    const el = makeScrollEl();
    el.scrollLeft = 180;
    const { colRef, rowRef, col } = makeHeaderRefs();
    const { result } = renderHook(() => useHeaderScrollSync(el, colRef, rowRef));

    // A zoom change rebuilds the header band; the fresh node starts untranslated.
    const rebuilt = document.createElement('div');
    colRef.current = rebuilt;
    act(() => result.current());

    expect(rebuilt.style.transform).toBe('translate3d(-180px, 0, 0)');
    expect(col.style.transform).toBe('translate3d(-180px, 0, 0)');
  });

  it('returns a stable callback across renders', () => {
    const el = makeScrollEl();
    const { colRef, rowRef } = makeHeaderRefs();
    const seen: Array<() => void> = [];
    function TestComponent() {
      seen.push(useHeaderScrollSync(el, colRef, rowRef));
      return null;
    }
    const { rerender } = render(React.createElement(TestComponent));
    rerender(React.createElement(TestComponent));

    expect(seen.length).toBeGreaterThan(1);
    expect(seen[0]).toBe(seen[seen.length - 1]);
  });

  it('detaches its listeners on unmount', () => {
    const el = makeScrollEl();
    const remove = vi.spyOn(el, 'removeEventListener');
    const { colRef, rowRef } = makeHeaderRefs();
    const { unmount } = renderHook(() => useHeaderScrollSync(el, colRef, rowRef));

    unmount();

    const events = remove.mock.calls.map((c) => c[0]);
    expect(events).toContain('scroll');
    expect(events).toContain('wheel');
    expect(events).toContain('touchmove');
  });

  it('stops writing after unmount', () => {
    const el = makeScrollEl();
    const { colRef, rowRef, col } = makeHeaderRefs();
    const { unmount } = renderHook(() => useHeaderScrollSync(el, colRef, rowRef));
    unmount();

    el.scrollLeft = 999;
    act(() => {
      el.dispatchEvent(new Event('scroll'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    flushFrames(3);

    // Still whatever the attach-time sync wrote, not the post-unmount offset.
    expect(col.style.transform).toBe('translate3d(0px, 0, 0)');
  });
});
