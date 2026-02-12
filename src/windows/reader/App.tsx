import { useState, useCallback, useRef } from "react";
import { usePdfDocument } from "./hooks/use-pdf-document";
import { useZoom } from "./hooks/use-zoom";
import { useReadingProgress } from "./hooks/use-reading-progress";
import { PdfViewer } from "./components/PdfViewer";
import { ReaderToolbar } from "./components/ReaderToolbar";
import { Sidebar } from "./components/Sidebar";
import type { ReadingProgress } from "@shared/lib/types";

export default function App() {
  const { pdf, pageCount, loading, error, filePath, hash } = usePdfDocument();
  const { zoom, setZoom, zoomIn, zoomOut, resetZoom } = useZoom();
  const [currentPage, setCurrentPage] = useState(1);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollToPageRef = useRef<((page: number) => void) | null>(null);

  const handleScrollToPageReady = useCallback(
    (fn: (page: number) => void) => {
      scrollToPageRef.current = fn;
    },
    [],
  );

  const handleRestore = useCallback(
    (progress: ReadingProgress) => {
      setCurrentPage(progress.current_page);
      setZoom(progress.zoom);
      // Scroll restoration happens after render
      setTimeout(() => {
        scrollToPageRef.current?.(progress.current_page);
      }, 300);
    },
    [setZoom],
  );

  useReadingProgress({
    hash,
    pageCount,
    currentPage,
    zoom,
    scrollMode: "continuous" as const,
    scrollPosition,
    onRestore: handleRestore,
  });

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      scrollToPageRef.current?.(page);
    },
    [],
  );

  const handleSidebarPageSelect = useCallback(
    (page: number) => {
      setCurrentPage(page);
      setTimeout(() => {
        scrollToPageRef.current?.(page);
      }, 50);
    },
    [],
  );

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  if (error || !pdf) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-destructive">
        <p className="text-sm">{error || "Failed to load PDF"}</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <div className="h-12 shrink-0 select-none flex">
        {/* Traffic light safe zone */}
        <div className="w-[70px] shrink-0" />
        <div data-tauri-drag-region className="flex-1 h-full" />
      </div>

      <ReaderToolbar
        currentPage={currentPage}
        pageCount={pageCount}
        onPageChange={handlePageChange}
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={resetZoom}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <div className="w-56 border-r border-border shrink-0 overflow-hidden">
            <Sidebar
              pdf={pdf}
              pageCount={pageCount}
              currentPage={currentPage}
              onPageSelect={handleSidebarPageSelect}
              filePath={filePath}
            />
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <PdfViewer
            pdf={pdf}
            pageCount={pageCount}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            zoom={zoom}
            setZoom={setZoom}
            scrollMode="continuous"
            onScrollPositionChange={setScrollPosition}
            onScrollToPageReady={handleScrollToPageReady}
          />
        </div>
      </div>
    </div>
  );
}
