import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';

/**
 * Frames of no movement to keep watching before parking the rAF loop.
 *
 * Momentum ("fling") scrolling can carry on — or resume — without delivering
 * another `scroll` event, so the loop cannot stop the instant the offset holds
 * still for one frame. ~6 frames is a tenth of a second at 60Hz: long enough to
 * ride through a stalled fling, short enough that idling costs nothing.
 */
const IDLE_FRAMES_BEFORE_PARK = 6;

/**
 * Keep the frozen column/row headers aligned with a scroll container.
 *
 * The offsets are written straight to the DOM as a transform rather than held
 * in React state, from two independent triggers.
 *
 * **Not React state.** A `setState` per scroll event re-renders the entire
 * grid — every visible cell and every overlay. React 17 does not batch updates
 * from native listeners, so each event paid for a full synchronous render; on a
 * large sheet or a slow device that cannot keep pace with the scroll, and the
 * headers fall behind the cells. The cells themselves do not need those
 * renders: the virtualizer re-renders on its own, only when the visible range
 * actually changes.
 *
 * **Two triggers, because neither alone is enough.**
 *
 * - Every scroll event writes the offset immediately. This is the trigger that
 *   always fires, including where `requestAnimationFrame` is starved — a
 *   backgrounded tab, a `display: none` iframe, an embedded webview.
 * - A rAF loop then samples the live `scrollLeft`/`scrollTop` each frame until
 *   the offset holds still. Browsers throttle or withhold `scroll` during
 *   momentum scrolling — worst on older WebKit and legacy Edge, where a fling
 *   delivers nothing until the finger lifts — so an event-driven write alone
 *   leaves the headers stranded mid-fling while the grid body keeps moving.
 *   Sampling per frame tracks the scroll whether or not an event arrives.
 *
 * The returned `syncHeaders` re-applies the current offsets on demand, for
 * geometry changes (zoom, a column resize) that rebuild the header nodes
 * without any scrolling.
 */
export function useHeaderScrollSync(
  scrollEl: HTMLElement | null,
  colHeaderRef: MutableRefObject<HTMLElement | null>,
  rowHeaderRef: MutableRefObject<HTMLElement | null>
): () => void {
  // `translate3d` rather than `translateX`/`translateY`: older engines only
  // promote 3D transforms to the compositor, and an unpromoted header band
  // repaints on the main thread on every frame of a scroll.
  const write = useCallback(
    (left: number, top: number) => {
      const cols = colHeaderRef.current;
      const rows = rowHeaderRef.current;
      if (cols) cols.style.transform = `translate3d(${-left}px, 0, 0)`;
      if (rows) rows.style.transform = `translate3d(0, ${-top}px, 0)`;
    },
    [colHeaderRef, rowHeaderRef]
  );

  // Held in a ref so `syncHeaders` stays referentially stable for callers that
  // list it as an effect dependency.
  const syncRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!scrollEl) {
      syncRef.current = () => {};
      return;
    }

    let frame = 0;
    let idleFrames = 0;
    // Deliberately unreachable offsets, so the first tick always writes.
    let lastLeft = NaN;
    let lastTop = NaN;

    const sync = () => {
      const { scrollLeft, scrollTop } = scrollEl;
      if (scrollLeft === lastLeft && scrollTop === lastTop) return false;
      lastLeft = scrollLeft;
      lastTop = scrollTop;
      write(scrollLeft, scrollTop);
      return true;
    };

    const tick = () => {
      frame = 0;
      if (sync()) {
        idleFrames = 0;
      } else if (++idleFrames > IDLE_FRAMES_BEFORE_PARK) {
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    const schedule = () => {
      // Write now, so the headers are correct even if no frame ever runs, then
      // let the loop cover the frames this event does not describe.
      sync();
      idleFrames = 0;
      if (frame === 0) frame = requestAnimationFrame(tick);
    };

    // The container can already be scrolled by the time this runs: a
    // programmatic `scrollToIndex` that landed during the previous render, or
    // an offset the browser restored on reload.
    sync();

    // `scroll` is the normal signal. `wheel` and `touchmove` are the safety
    // net: they fire at the start of a gesture that a throttling browser may
    // then service without further `scroll` events, and they are what get the
    // rAF loop running for it.
    scrollEl.addEventListener('scroll', schedule, { passive: true });
    scrollEl.addEventListener('wheel', schedule, { passive: true });
    scrollEl.addEventListener('touchmove', schedule, { passive: true });

    // Coming back to a backgrounded tab: rAF was parked the whole time, so any
    // scroll that happened while hidden may not have been written yet.
    const onVisible = () => {
      if (!document.hidden) schedule();
    };
    document.addEventListener('visibilitychange', onVisible);

    syncRef.current = () => {
      lastLeft = NaN;
      lastTop = NaN;
      sync();
    };

    return () => {
      scrollEl.removeEventListener('scroll', schedule);
      scrollEl.removeEventListener('wheel', schedule);
      scrollEl.removeEventListener('touchmove', schedule);
      document.removeEventListener('visibilitychange', onVisible);
      if (frame !== 0) cancelAnimationFrame(frame);
      syncRef.current = () => {};
    };
  }, [scrollEl, write]);

  return useCallback(() => syncRef.current(), []);
}
