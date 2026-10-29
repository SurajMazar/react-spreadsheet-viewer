import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';

export interface DropdownEditorProps {
  row: number;
  col: number;
  /** The cell's current value; the matching item starts highlighted. */
  value: string;
  items: string[];
  style: CSSProperties;
  onCommit: (row: number, col: number, value: string) => void;
  onCancel: () => void;
}

/** Pixels of popup the grid needs below the cell before the list opens upwards. */
const MIN_ROOM_BELOW = 160;

/**
 * The editor for a list-validated cell: the cell with a dropdown arrow and a
 * list of the allowed values under it, in the manner of a spreadsheet's
 * in-cell dropdown. Arrow keys move, Enter or a click picks, typing a letter
 * jumps to the next item starting with it, Escape or clicking away cancels.
 */
export default function DropdownEditor({ row, col, value, items, style, onCommit, onCancel }: DropdownEditorProps) {
  const [active, setActive] = useState(() => Math.max(0, items.indexOf(value)));
  const [openUp, setOpenUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  // Open upwards when the cell sits near the bottom of the visible grid.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const scroller = root?.closest('.sv-grid-scroll');
    if (!root || !scroller) return;
    const cell = root.getBoundingClientRect();
    const view = scroller.getBoundingClientRect();
    const below = view.bottom - cell.bottom;
    const above = cell.top - view.top;
    setOpenUp(below < MIN_ROOM_BELOW && above > below);
  }, []);

  // Keep the highlighted item in view while moving with the keyboard.
  useEffect(() => {
    const item = listRef.current?.children[active] as HTMLElement | undefined;
    item?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const pick = useCallback(
    (index: number) => {
      const item = items[index];
      if (item !== undefined) onCommit(row, col, item);
    },
    [items, row, col, onCommit]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActive((i) => Math.min(items.length - 1, i + 1));
          return;
        case 'ArrowUp':
          e.preventDefault();
          setActive((i) => Math.max(0, i - 1));
          return;
        case 'Home':
          e.preventDefault();
          setActive(0);
          return;
        case 'End':
          e.preventDefault();
          setActive(items.length - 1);
          return;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          pick(active);
          return;
        case 'Escape':
          e.preventDefault();
          onCancel();
          return;
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const letter = e.key.toLowerCase();
            for (let step = 1; step <= items.length; step++) {
              const i = (active + step) % items.length;
              if (items[i].toLowerCase().startsWith(letter)) {
                setActive(i);
                break;
              }
            }
          }
      }
    },
    [items, active, pick, onCancel]
  );

  return (
    <div
      ref={rootRef}
      className="sv-editable-cell sv-dropdown"
      style={{ ...style, zIndex: 50 }}
      tabIndex={-1}
      role="combobox"
      aria-expanded="true"
      aria-haspopup="listbox"
      onKeyDown={handleKeyDown}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onCancel();
      }}
    >
      <div className="sv-dropdown-value">
        <span className="sv-dropdown-value-text">{value}</span>
        <span className="sv-dropdown-arrow" aria-hidden="true">
          <DropdownArrow />
        </span>
      </div>
      <ul
        ref={listRef}
        className={`sv-dropdown-list${openUp ? ' sv-dropdown-list-up' : ''}`}
        role="listbox"
      >
        {items.map((item, i) => (
          <li
            key={item}
            role="option"
            aria-selected={item === value}
            className={`sv-dropdown-item${i === active ? ' sv-dropdown-item-active' : ''}${
              item === value ? ' sv-dropdown-item-selected' : ''
            }`}
            // Keep focus on the editor so a click is not read as clicking away.
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => pick(i)}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The chevron used by the in-cell dropdown button and the open editor. */
export function DropdownArrow() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
      <path d="M1 3h8L5 8z" />
    </svg>
  );
}
