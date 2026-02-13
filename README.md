# PDF Reader

A lightweight PDF reader built for macOS with iCloud reading progress sync across devices.

[中文文档](./README_zh.md)

<p align="center">
  <img src="images/App-Icon.jpg" alt="PDF Reader" width="500">
</p>

## Screenshots

| Library | Reader |
|---------|--------|
| ![Library](images/PDF-Library.jpg) | ![Reader](images/Reader-Page.jpg) |

## Features

- **Library** — Browse your PDFs in a grid view with cover thumbnails, search by title, sort by name / date / size
- **Continuous Scrolling** — Smooth page-by-page reading with priority-based rendering
- **Pinch-to-Zoom** — Native macOS trackpad zoom, plus keyboard and toolbar controls
- **Sidebar Navigation** — PDF outline (bookmarks) tree and thumbnail strip for quick page jumping
- **PDF Management** — Import, rename, delete (Trash), and reveal in Finder
- **Dark Mode** — Follows system appearance automatically
- **File Watching** — Auto-refreshes when PDFs are added or removed from the books directory
- **Multi-Window** — Each PDF opens in its own window; reopening focuses the existing one

## Lightweight & Efficient

Built with **Tauri 2 + Rust**, PDF Reader uses the system-native WebView instead of bundling Chromium:

- **Small footprint** — Installer is ~10 MB (vs. 100 MB+ for Electron apps)
- **Low memory usage** — No embedded browser engine, leverages macOS WKWebView directly
- **Fast & smooth** — Rust backend with zero GC overhead handles PDF parsing and file I/O efficiently

## Reading Progress Sync

PDF Reader automatically saves and syncs your reading progress via iCloud, so you can pick up where you left off on any Mac.

### How It Works

Progress is stored in two tiers:

```
Local copy:    ~/Library/Application Support/com.yangguanlin.pdf-reader/Progress/{hash}.json
Central copy:  iCloud Drive / PDFReader / Progress / {hash}.json
```

Each progress file carries a **version number**. On every save the version increments. When syncing, **the higher version always wins** — simple, conflict-free.

### Sync Timing

| Event | Action |
|-------|--------|
| Page turn / zoom change | Save after 1s debounce |
| Periodic | Auto-save every 30s |
| iCloud poll | Pull remote updates every 3s, restore if newer |
| Window close | Force save + sync before closing |

### Safety

- **Atomic writes** — Writes to a temp file first, then renames. No half-written data.
- **No iCloud? No problem** — Falls back to `~/.pdf-reader/` automatically. Progress is still saved locally.

## Installation

### Download

Download the latest `.dmg` from the [Releases](../../releases) page.

Both **Apple Silicon** (arm64) and **Intel** (x64) builds are available.

### Build from Source

```bash
git clone https://github.com/yangguanlin/pdf-tool-macos.git
cd pdf-tool-macos
pnpm install
pnpm tauri build     # Produces .app + .dmg
```

> Requires: macOS 10.15+, Node.js 18+, pnpm, Rust toolchain, Xcode Command Line Tools.

## Storage Paths

```
~/Library/Mobile Documents/com~apple~CloudDocs/PDFReader/   # iCloud (preferred)
~/.pdf-reader/                                               # Local fallback
  ├── Books/           # Your PDF files
  ├── Progress/        # Reading progress (central copy)
  └── Thumbnails/      # Cached cover thumbnails

~/Library/Application Support/com.yangguanlin.pdf-reader/
  └── Progress/        # Reading progress (local copy)
```

## Roadmap

- [ ] Windows support
- [ ] AI-powered summarization (based on community support)
- [ ] Official App Store release

## Sponsor

If you find PDF Reader useful, consider buying me a coffee to support future development. With enough community support, AI summarization and an official App Store release will be prioritized.

<p align="center">
  <img src="images/mac_1770949025842.jpg" alt="WeChat Pay" width="300">
</p>

## Tech Stack

Built with [Tauri 2](https://v2.tauri.app/) + [React 19](https://react.dev/) + [Rust](https://www.rust-lang.org/) + [pdfjs-dist](https://github.com/nicedoc/pdfjs-dist) + [Tailwind CSS v4](https://tailwindcss.com/)

## License

[MIT](./LICENSE)
