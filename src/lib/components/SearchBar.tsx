import { useState, useCallback, useEffect, useRef, type KeyboardEvent } from 'react';
import { useViewerStore } from '../context/ViewerContext';
import { colIndexToLetter } from '../utils/rangeParser';

interface SearchResult {
  row: number;
  col: number;
  value: unknown;
}

export default function SearchBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeSheet = useViewerStore((s) => s.activeSheet);
  const sheetData = useViewerStore((s) => (s.activeSheet ? s.sheets[s.activeSheet] : null));
  const setActiveCell = useViewerStore((s) => s.setActiveCell);
  const setRangeInput = useViewerStore((s) => s.setRangeInput);

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
        setResults([]);
        setCurrentIdx(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const navigateToResult = useCallback(
    (result: SearchResult | undefined) => {
      if (!result || !activeSheet) return;
      setActiveCell(result.row, result.col);
      const label = `${colIndexToLetter(result.col)}${result.row + 1}`;
      setRangeInput(activeSheet, label);
    },
    [activeSheet, setActiveCell, setRangeInput]
  );

  const handleSearch = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery);
      if (!searchQuery.trim() || !sheetData) {
        setResults([]);
        setCurrentIdx(-1);
        return;
      }

      const q = searchQuery.toLowerCase();
      const matches: SearchResult[] = [];
      const maxResults = 1000;

      for (let r = 0; r < sheetData.data.length && matches.length < maxResults; r++) {
        const row = sheetData.data[r];
        if (!row) continue;
        for (let c = 0; c < row.length && matches.length < maxResults; c++) {
          const val = String(row[c] || '').toLowerCase();
          if (val.includes(q)) {
            matches.push({ row: r, col: c, value: row[c] });
          }
        }
      }

      setResults(matches);
      if (matches.length > 0) {
        setCurrentIdx(0);
        navigateToResult(matches[0]);
      } else {
        setCurrentIdx(-1);
      }
    },
    [sheetData, navigateToResult]
  );

  const goNext = useCallback(() => {
    if (results.length === 0) return;
    const next = (currentIdx + 1) % results.length;
    setCurrentIdx(next);
    navigateToResult(results[next]);
  }, [currentIdx, results, navigateToResult]);

  const goPrev = useCallback(() => {
    if (results.length === 0) return;
    const prev = (currentIdx - 1 + results.length) % results.length;
    setCurrentIdx(prev);
    navigateToResult(results[prev]);
  }, [currentIdx, results, navigateToResult]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.shiftKey ? goPrev() : goNext();
      }
    },
    [goNext, goPrev]
  );

  if (!isOpen) return null;

  return (
    <div className="sv-search-bar">
      <div className="sv-search-bar-inner">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sv-search-icon">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="sv-search-input"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find in sheet..."
          spellCheck={false}
        />
        {results.length > 0 && (
          <span className="sv-search-count">
            {currentIdx + 1} of {results.length}
          </span>
        )}
        <button className="sv-search-nav-btn" onClick={goPrev} disabled={results.length === 0} title="Previous (Shift+Enter)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <button className="sv-search-nav-btn" onClick={goNext} disabled={results.length === 0} title="Next (Enter)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <button
          className="sv-search-close-btn"
          onClick={() => {
            setIsOpen(false);
            setQuery('');
            setResults([]);
            setCurrentIdx(-1);
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
