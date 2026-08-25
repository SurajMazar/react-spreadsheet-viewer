import { useEffect, type RefObject } from 'react';

/**
 * Keys the browser acts on by itself: with focus anywhere inside the viewer
 * they scroll the nearest scroll container — the grid — without any handler of
 * ours being involved. Blocking the viewer's own navigation is therefore not
 * enough to stop the grid moving under the keyboard; these have to be
 * swallowed too.
 */
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
  'Spacebar',
]);

/** Everything the browser puts in the tab order without an explicit tabindex. */
const FOCUSABLE_SELECTOR = 'a[href], area[href], button, input, select, textarea, iframe, [tabindex]';

/**
 * The event target as an element, or null — a key event can be aimed at the
 * window itself, which has neither a tag name nor a place in the DOM tree.
 */
function targetElement(target: EventTarget | null): HTMLElement | null {
  return target && (target as Node).nodeType === 1 ? (target as HTMLElement) : null;
}

/** Text entry, where arrow keys move the caret rather than the viewport. */
function isTextEntry(el: HTMLElement): boolean {
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * Take the whole viewer off the keyboard while `enabled` is true.
 *
 * Two things the viewer's own key handlers cannot cover:
 *
 * 1. **Native scrolling.** Arrow keys, Page keys, Home/End and Space scroll the
 *    grid's scroll container as a browser default action whenever focus sits
 *    inside the viewer. Only key events aimed at the viewer are swallowed —
 *    with focus elsewhere the browser is scrolling the host page, which is
 *    none of the viewer's business.
 * 2. **Tab order.** The viewer's buttons and inputs are natively focusable, so
 *    Tab walks straight into them. They are given `tabindex="-1"` for as long as
 *    the lockdown lasts — focus still works by mouse and programmatically (the
 *    cell editor focuses itself), and Tab from inside still moves on past the
 *    viewer, so no focus trap is created.
 *
 * Typing inside the viewer's own inputs stays untouched: a focused cell editor
 * or search box still gets its arrow keys, so the caret moves normally.
 */
export function useKeyboardLockdown(
  rootRef: RefObject<HTMLElement | null>,
  enabled: boolean
): void {
  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    if (!root) return;

    // --- 1. Swallow the browser's own scrolling ---------------------------
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (!SCROLL_KEYS.has(e.key)) return;
      const target = targetElement(e.target);
      if (target && isTextEntry(target)) return;
      const focused = targetElement(document.activeElement);
      const aimedAtViewer =
        (!!target && root.contains(target)) || (!!focused && root.contains(focused));
      if (aimedAtViewer) e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown, true);

    // --- 2. Drop every control out of the tab order ------------------------
    const patched = new Map<HTMLElement, string | null>();

    const strip = (el: Element) => {
      const node = el as HTMLElement;
      if (patched.has(node)) return;
      patched.set(node, node.getAttribute('tabindex'));
      node.setAttribute('tabindex', '-1');
    };

    // Only ever called on the root once and on freshly added nodes, so the
    // grid re-rendering rows while scrolling stays cheap.
    const scan = (node: Element) => {
      if (node.matches(FOCUSABLE_SELECTOR)) strip(node);
      node.querySelectorAll(FOCUSABLE_SELECTOR).forEach(strip);
    };
    scan(root);

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === 1) scan(node as Element);
        });
      }
    });
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      observer.disconnect();
      patched.forEach((original, node) => {
        if (original === null) node.removeAttribute('tabindex');
        else node.setAttribute('tabindex', original);
      });
    };
  }, [rootRef, enabled]);
}
