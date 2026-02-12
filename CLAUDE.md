# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A macOS PDF reader desktop app built with **Tauri 2 + React 19 + Rust**. Features a library window for browsing PDFs and a reader window for viewing them with continuous scrolling, pinch-to-zoom, reading progress persistence, and dark mode.

## Development Commands

```bash
pnpm tauri dev       # Full dev mode: Vite HMR (port 1420) + Tauri hot reload
pnpm dev             # Vite dev server only (no Tauri shell)
pnpm build           # TypeScript check + Vite production build
pnpm tauri build     # Build platform installer (DMG)
```

No test framework is configured.

## Architecture

### Multi-Window Design

Two independent Tauri WebView windows, each with its own Vite entry point:

- **Library** (`src/windows/library/`) — Main window (1000x700). Displays a grid of PDFs from the books directory. Entry: `index.html`.
- **Reader** (`src/windows/reader/`) — Spawned per PDF (900x800). Renders PDF pages with pdfjs-dist, supports zoom/scroll/progress. Entry: `index.html?path={filePath}&hash={hash}`.

Reader windows are created dynamically in `src-tauri/src/window.rs` with label `reader-{hash}` and reused if already open.

### Path Aliases

| Alias | Path |
|-------|------|
| `@shared/*` | `src/shared/*` |
| `@library/*` | `src/windows/library/*` |
| `@reader/*` | `src/windows/reader/*` |

Configured in both `tsconfig.json` and `vite.config.ts`.

### Frontend Structure

- `src/shared/` — Cross-window shared code: UI components (shadcn/ui), hooks (`use-theme`), IPC command wrappers (`lib/commands.ts`), event listeners (`lib/events.ts`), types, logger, and global CSS with Tailwind v4 theme variables.
- `src/windows/library/` — BookGrid, BookCard, Toolbar, EmptyState + `useBooks` hook for scanning/filtering/sorting.
- `src/windows/reader/` — PdfViewer (canvas-based with priority render queue), ReaderToolbar, Sidebar (outline + thumbnails) + hooks for zoom, drag-scroll, pinch-zoom, reading progress.

### Rust Backend (`src-tauri/src/`)

| Module | Purpose |
|--------|---------|
| `lib.rs` | Tauri builder setup, plugin registration, IPC handler registration |
| `commands.rs` | IPC commands: scan_books, import_pdf, get_pdf_outline, load/save_progress, open_reader_window, reset_magnification, etc. |
| `pdf_info.rs` | PDF metadata extraction (page count, title, outline, SHA256 hash) via lopdf |
| `progress.rs` | Reading progress persistence as JSON files |
| `icloud.rs` | Books/progress directory resolution (iCloud Drive → `~/.pdf-reader/` fallback) |
| `watcher.rs` | File system watcher with 500ms debounce, emits `books:changed` event |
| `window.rs` | Reader window creation with macOS WKWebView magnification setup |

### IPC Pattern

Frontend calls are wrapped in `src/shared/lib/commands.ts` using Tauri's `invoke()`. Backend handlers are `#[tauri::command]` functions registered in `lib.rs`. The single event type `books:changed` is emitted by the file watcher and listened to via `src/shared/lib/events.ts`.

### PDF Rendering

`PdfViewer.tsx` uses pdfjs-dist with a priority-based render queue (`lib/render-queue.ts`). Pages are rendered to off-screen canvases then blitted to visible canvases to avoid race conditions. A generation counter (`renderGenRef`) invalidates stale renders on zoom changes.

### Storage Paths

```
~/Library/Mobile Documents/com~apple~CloudDocs/PDFReader/  (iCloud, preferred)
~/.pdf-reader/                                              (local fallback)
  ├── Books/         # PDF files
  ├── Progress/      # {hash}.json reading progress
  └── Thumbnails/    # Cached page thumbnails
```

## Key Conventions

- **TypeScript strict mode** with `noUnusedLocals` and `noUnusedParameters`
- **Tailwind CSS v4** with CSS variable-based theming (light/dark/system)
- **shadcn/ui** components in `src/shared/components/ui/`
- **Debug logging** enabled via `?debug=1`, `localStorage pdf-debug`, or `PDF_DEBUG=1` env var
- Scroll mode is hardcoded to `"continuous"` (single-page mode was removed)
- macOS-specific: WKWebView pinch-to-zoom with native magnification reset via `reset_magnification` command
