# CLAUDE.md

Operational guide for AI agents working in this repo. **[AGENTS.md](AGENTS.md) is the full knowledge base** (architecture, data flow, per-file reference, design decisions) — read it for depth. This file is the short, high-signal layer: what to run, what not to break, and how work ships.

## What this is

`rc-sheet-viewer-17` — a React component library that renders Excel (`.xlsx`, `.xls`) and CSV files in a Google Sheets-like UI, published to npm. Handles 100k+ rows via virtualization. Supports React **17, 18, and 19**.

- **The published library is `src/lib/` only.** Everything else (`src/demo/`, `stories/`) is dev-time and not shipped.
- Data comes in via the `source` prop (URL | `File` | `ArrayBuffer` | `ArrayBufferView`) — there is no built-in upload UI in the library (the demo app adds one).
- Public entry: `src/lib/index.ts`. Root component: `src/lib/SheetViewer.tsx` (`forwardRef` + imperative handle). State: instance-scoped Zustand store in `src/lib/context/ViewerContext.tsx`.

## Commands (pnpm — Node 24, pnpm 10)

```bash
pnpm install
pnpm dev            # demo app (vite)
pnpm typecheck      # tsc --noEmit — must be 0 errors
pnpm test           # vitest run — ~568 tests across 18 files
pnpm lint           # eslint .
pnpm build:lib      # build the publishable library → dist/
pnpm storybook      # component stories at :6006
```

Before proposing a change is done, run `pnpm typecheck` and `pnpm test`. Both must be green.

## Non-negotiable constraints

**React 17 compatibility is load-bearing** — the whole point of this package (`-17` suffix). Do not break it:

- **No React 18+ APIs** anywhere in `src/lib/`: `useId`, `useTransition`, `useDeferredValue`, `useInsertionEffect`, `startTransition`, or `React.useSyncExternalStore` directly.
- **Zustand access** goes through `zustand/vanilla` (`createStore`) + `zustand/traditional` (`useStoreWithEqualityFn`), which uses the `use-sync-external-store` shim. Do **not** switch to `useStore` from `zustand` — it needs React 18.
- **JSX is the classic transform** (`"jsx": "react"`): every `.tsx` file needs an explicit `import React from 'react'`. Build uses `jsxRuntime: 'classic'`.
- **`react` / `react-dom` stay in `peerDependencies`**, never `dependencies` — moving them causes duplicate-React "Invalid hook call" crashes for consumers.
- Wrap virtual item `key` values in `String()` (React 17's `Key` type excludes `bigint`).

**Public API surface** — `SheetViewerProps` and `SheetViewerHandle` in `src/lib/types.ts` are the contract. Adding a prop means: update `types.ts` → destructure in `SheetViewerInner` → thread through → update the imperative handle if needed → update `README.md`. Don't silently change existing prop semantics.

**Zoom works on base pixels** — the store holds unzoomed column widths and row heights; `VirtualGrid` applies `scaleToZoom()` when it feeds the virtualizers, and nowhere else. Two rules follow:

- Anything deriving a size from a pointer position must divide the delta by `zoom` before writing it back (see the column/row resize handler), and anything writing a width must write a base width (see auto-fit).
- Any change to zoom must invalidate both virtualizers (`colVirtualizer.measure()` / `rowVirtualizer.measure()`), or cells drift out of line with the headers.

Never reach for `transform: scale()` on the scroll container — it would desync hit testing, scroll offsets and every overlay built from `measurementsCache`. AGENTS.md §10 has the full reasoning.

**`XLSX.read` needs `cellStyles: true`** — without it SheetJS never populates `worksheet['!cols']` and all Excel column widths are silently dropped. Don't remove that option from `useFileParser.ts`.

## Conventions

- **Styling:** plain CSS only, all in `src/lib/styles/sheet-viewer.css`, every class prefixed `sv-`, colors via `--sv-color-*` custom properties (the `theme` prop overrides these). No Tailwind, CSS modules, or CSS-in-JS.
- **Tests** live in `__tests__/` next to the code, Vitest + React Testing Library **v12** (last version supporting React 17). New utilities/store actions should ship with tests.
- **TypeScript strict**, no `.js` files in `src/`.
- XLSX internals SheetJS doesn't expose (charts, pivots, styles) are read by unzipping the raw file with `fflate` and parsing XML — see `src/lib/utils/{chartExtractor,pivotReconstructor,styleExtractor}.ts`.
- **Toolbar vs formula bar:** the toolbar holds only built-in chrome (filename, Charts, Download). Consumer-facing controls — the zoom picker and registered `tools` — live in the formula bar row's action groups (`.sv-formula-bar-actions-left` / `-right`), so `showToolbar={false}` doesn't take them away. `toolsPlacement`/`zoomPlacement` choose the end; a tool's own `placement` overrides the former.
- **Zoom stepping follows `zoomLevels`, not the bounds.** `zoomIn`/`zoomOut` stop at the top and bottom of the level list; `minZoom`/`maxZoom` only bound `setZoom`. Don't "fix" `stepZoom` to fall through to the bounds — that lands the viewer on a zoom the picker never offers.
- **New tools go in the consumer's code, not the library.** `tools` takes `SheetViewerTool[]`; tools needing options are built with `defineSheetViewerTool` (`src/lib/tools/defineTool.ts`), which infers and binds their config so the array stays a single concrete type with no `any`. Don't add tool-specific logic to `SheetViewer`/`ToolsSection`, and don't loosen the tool types into a generic plugin bus.

## Workflow

- Remote: `github.com:SurajMazar/react-spreadsheet-viewer`. **Default / PR base branch is `react-version-17`** (not `main`).
- Branch naming in use: `feature/*`, `feat/*`, `bugfix/*`. Open PRs against `react-version-17`.
- Commit/push only when asked. There is a `react-version-19` branch on the remote for the React 19 line.
- Publishing: bump `package.json` version → `pnpm build:lib` (auto-runs via `prepublishOnly`) → `npm publish --otp=<2FA code>`.

## Known limitations (see AGENTS.md §15)

Main-thread parsing (no Web Worker), light theme only, no freeze panes, no built-in sort/filter, limited image extraction, hidden Excel columns render at default width, row heights from the file are not preserved.
