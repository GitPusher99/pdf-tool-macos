# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A macOS PDF reader desktop app built with **Tauri 2 + React 19 + Rust**. Features a library window for browsing PDFs and a reader window for viewing them with continuous scrolling, pinch-to-zoom, reading progress persistence via iCloud sync, and dark mode.

## Development Commands

```bash
pnpm tauri dev       # Full dev mode: Vite HMR (port 1420) + Tauri Rust hot reload
pnpm dev             # Vite dev server only (no Tauri shell)
pnpm build           # TypeScript check + Vite production build
pnpm tauri build     # Build platform installer (.app + DMG)
```

No test framework or linter is configured. TypeScript strict mode (`noUnusedLocals`, `noUnusedParameters`) is the only static check, run during `pnpm build` via `tsc`.

## Architecture

### Multi-Window Design

Two independent Tauri WebView windows, each with its own Vite entry point:

- **Library** (`src/windows/library/`) — Main window (1000x700, `titleBarStyle: Overlay` with hidden title). Displays a grid of PDFs from the books directory. Entry: `index.html`.
- **Reader** (`src/windows/reader/`) — Spawned per PDF (900x800). Renders PDF pages with pdfjs-dist, supports zoom/scroll/progress. Entry: `index.html?path={filePath}&hash={hash}`.

Reader windows are created dynamically in `src-tauri/src/window.rs` with label `reader-{hash}` and reused (focused) if already open. Both window types share capabilities via the `reader-*` wildcard in `src-tauri/capabilities/default.json`.

### Path Aliases

| Alias | Path |
|-------|------|
| `@shared/*` | `src/shared/*` |
| `@library/*` | `src/windows/library/*` |
| `@reader/*` | `src/windows/reader/*` |

Configured in both `tsconfig.json` and `vite.config.ts`.

### Frontend Structure

- `src/shared/` — Cross-window shared code: UI components (shadcn/ui), hooks (`use-theme`), IPC command wrappers (`lib/commands.ts`), event listeners (`lib/events.ts`), types, logger, and global CSS with Tailwind v4 theme variables.
- `src/windows/library/` — BookGrid, BookCard, Toolbar, EmptyState + `useBooks` hook for scanning/filtering/sorting + `useThumbnail` for cached thumbnails.
- `src/windows/reader/` — PdfViewer (canvas-based with priority render queue), ReaderToolbar, Sidebar (OutlineTree + ThumbnailList) + hooks for zoom, drag-scroll, pinch-zoom, reading progress.

### Rust Backend (`src-tauri/src/`)

| Module | Purpose |
|--------|---------|
| `lib.rs` | Tauri builder setup, plugin registration (opener, dialog, fs, process), IPC handler registration, file watcher startup |
| `commands.rs` | 14 IPC commands: scan_books, import_pdf, get_pdf_outline, load/save/sync_progress, open_reader_window, reset_magnification, reveal_in_finder, delete_pdf, rename_pdf, etc. |
| `pdf_info.rs` | PDF metadata extraction (page count, title, outline, SHA256 hash) via lopdf |
| `progress.rs` | Reading progress persistence with version-number conflict resolution and mutex locking |
| `icloud.rs` | Storage directory resolution: iCloud Drive → `~/.pdf-reader/` fallback. Also `ensure_directories()` on startup |
| `watcher.rs` | File system watcher with 500ms debounce, emits `books:changed` event |
| `window.rs` | Reader window creation with macOS WKWebView magnification setup via objc2 |

### IPC Pattern

Frontend calls are wrapped in `src/shared/lib/commands.ts` using Tauri's `invoke()`. Backend handlers are `#[tauri::command]` functions registered in `lib.rs`. Two event types:
- `books:changed` — emitted by the file watcher when the Books directory changes
- `progress:changed` — emitted by `save_progress` command, carries `ReadingProgress` payload

Both listened via `src/shared/lib/events.ts`.

### PDF Rendering

`PdfViewer.tsx` uses pdfjs-dist with a priority-based render queue (`lib/render-queue.ts`, max 2 concurrent). Pages are rendered to off-screen canvases then blitted to visible canvases to avoid race conditions. A generation counter (`renderGenRef`) invalidates stale renders on zoom changes. Priority = distance from current page (closer pages render first).

### iCloud Progress Sync

Two-tier storage with version-number arbitration:

- **Local progress**: `~/Library/Application Support/com.yangguanlin.pdf-reader/Progress/{hash}.json`
- **Central progress**: iCloud Drive (or `~/.pdf-reader/Progress/{hash}.json` fallback)

Sync logic in `progress.rs`: compares version numbers, higher version wins. On save, version auto-increments. Atomic writes via temp file + rename.

Frontend timing (`use-reading-progress.ts`):
- **On change**: 1s debounced save after page/zoom change
- **Periodic save**: every 30s
- **iCloud sync poll**: every 3s (pulls remote updates, restores if newer)
- **On close**: forced save + sync before window closes

### Storage Paths

```
~/Library/Mobile Documents/com~apple~CloudDocs/PDFReader/  (iCloud, preferred)
~/.pdf-reader/                                              (local fallback)
  ├── Books/         # PDF files
  ├── Progress/      # {hash}.json reading progress (central copy)
  └── Thumbnails/    # Cached page thumbnails

~/Library/Application Support/com.yangguanlin.pdf-reader/
  └── Progress/      # {hash}.json reading progress (local copy)
```

### Security

- **Asset protocol** scope restricted to iCloud and `.pdf-reader` directories (configured in `tauri.conf.json`)
- **FS plugin** read access limited to same directories + `$TEMP/pdf-reader/` (configured in `capabilities/default.json`)
- PDF deletion uses canonical path validation before trash
- CSP is disabled (`null`) to allow pdfjs worker loading

## Key Conventions

- **TypeScript strict mode** with `noUnusedLocals` and `noUnusedParameters`
- **Tailwind CSS v4** with CSS variable-based theming (light/dark/system)
- **shadcn/ui** components in `src/shared/components/ui/`
- **Debug logging** enabled via `?debug=1`, `localStorage pdf-debug`, or `PDF_DEBUG=1` env var
- Scroll mode is hardcoded to `"continuous"` (single-page mode was removed)
- macOS-specific: WKWebView pinch-to-zoom with native magnification reset via `reset_magnification` command
- Rust dev dependencies use `opt-level = 3` for acceptable performance during development
