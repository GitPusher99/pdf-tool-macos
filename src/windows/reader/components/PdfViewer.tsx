import { useRef, useEffect, useState, useCallback } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

interface PdfViewerProps {
  pdf: PDFDocumentProxy;
  pageCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  zoom: number;
  scrollMode: "continuous" | "single";
  onScrollPositionChange?: (position: number) => void;
  onScrollToPageReady?: (fn: (page: number) => void) => void;
}

interface PageInfo {
  width: number;
  height: number;
}

export function PdfViewer({
  pdf,
  pageCount,
  currentPage,
  onPageChange,
  zoom,
  scrollMode,
  onScrollPositionChange,
  onScrollToPageReady,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageInfos, setPageInfos] = useState<PageInfo[]>([]);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1]));
  const renderTasksRef = useRef<Map<number, RenderTask>>(new Map());
  const canvasMapRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderedPagesRef = useRef<Set<string>>(new Set());
  const programmaticScrollRef = useRef(false);

  // Load page dimensions progressively
  useEffect(() => {
    let cancelled = false;
    async function loadPageInfos() {
      const infos: PageInfo[] = [];
      const FIRST_BATCH = 10;
      const BATCH_SIZE = 50;

      for (let i = 1; i <= pageCount; i++) {
        if (cancelled) return;
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 1.0 });
        infos.push({ width: vp.width, height: vp.height });

        if (
          i === FIRST_BATCH ||
          (i > FIRST_BATCH && i % BATCH_SIZE === 0) ||
          i === pageCount
        ) {
          if (!cancelled) setPageInfos([...infos]);
        }
      }
    }
    loadPageInfos();
    return () => {
      cancelled = true;
    };
  }, [pdf, pageCount]);

  // Render a single page
  const renderPage = useCallback(
    async (pageNum: number) => {
      const key = `${pageNum}-${zoom}`;
      if (renderedPagesRef.current.has(key)) return;

      const canvas = canvasMapRef.current.get(pageNum);
      if (!canvas) return;

      // Cancel previous render for this page
      const prevTask = renderTasksRef.current.get(pageNum);
      if (prevTask) {
        prevTask.cancel();
        renderTasksRef.current.delete(pageNum);
      }

      try {
        const page: PDFPageProxy = await pdf.getPage(pageNum);
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: zoom * dpr });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        const ctx = canvas.getContext("2d")!;
        const renderTask = page.render({ canvasContext: ctx, viewport });
        renderTasksRef.current.set(pageNum, renderTask);

        await renderTask.promise;
        renderedPagesRef.current.add(key);
        renderTasksRef.current.delete(pageNum);
      } catch (err: unknown) {
        if (err && typeof err === "object" && "name" in err && (err as { name: string }).name !== "RenderingCancelledException") {
          console.error(`Failed to render page ${pageNum}:`, err);
        }
      }
    },
    [pdf, zoom],
  );

  // Clear render cache when zoom changes
  useEffect(() => {
    renderedPagesRef.current.clear();
  }, [zoom]);

  // Continuous scroll: observe visible pages
  useEffect(() => {
    if (scrollMode !== "continuous" || pageInfos.length === 0) return;

    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setVisiblePages((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const pageNum = Number(
              (entry.target as HTMLElement).dataset.pageNum,
            );
            if (entry.isIntersecting) {
              next.add(pageNum);
            } else {
              next.delete(pageNum);
            }
          }
          return next;
        });
      },
      {
        root: container,
        rootMargin: "200px 0px",
        threshold: 0.01,
      },
    );

    const pageElements = container.querySelectorAll("[data-page-num]");
    pageElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [scrollMode, pageInfos, zoom]);

  // Render visible pages + buffer
  useEffect(() => {
    if (scrollMode !== "continuous") return;
    const buffer = 1;
    for (const pageNum of visiblePages) {
      for (
        let p = Math.max(1, pageNum - buffer);
        p <= Math.min(pageCount, pageNum + buffer);
        p++
      ) {
        renderPage(p);
      }
    }
  }, [visiblePages, scrollMode, pageCount, renderPage]);

  // Single page mode: render current page
  useEffect(() => {
    if (scrollMode !== "single") return;
    renderPage(currentPage);
  }, [scrollMode, currentPage, renderPage]);

  // Update current page from scroll position
  useEffect(() => {
    if (scrollMode !== "continuous") return;
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (programmaticScrollRef.current) return;
      onScrollPositionChange?.(container.scrollTop);

      // Only query visible pages (typically 5-10) instead of all pages (could be 500+)
      if (visiblePages.size > 0) {
        let bestPage = currentPage;
        let bestRatio = 0;
        const containerRect = container.getBoundingClientRect();

        for (const pageNum of visiblePages) {
          const el = container.querySelector(`[data-page-num="${pageNum}"]`) as HTMLElement;
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          const visibleTop = Math.max(rect.top, containerRect.top);
          const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
          const visibleHeight = Math.max(0, visibleBottom - visibleTop);
          const ratio = visibleHeight / containerRect.height;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestPage = pageNum;
          }
        }

        if (bestPage !== currentPage) {
          onPageChange(bestPage);
        }
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [scrollMode, currentPage, onPageChange, onScrollPositionChange, visiblePages]);

  // Keyboard navigation for single page mode
  useEffect(() => {
    if (scrollMode !== "single") return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        onPageChange(Math.min(pageCount, currentPage + 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        onPageChange(Math.max(1, currentPage - 1));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [scrollMode, currentPage, pageCount, onPageChange]);

  // Scroll to page in continuous mode
  const scrollToPage = useCallback(
    (pageNum: number) => {
      if (scrollMode !== "continuous") return;
      const container = containerRef.current;
      if (!container) return;

      const el = container.querySelector(
        `[data-page-num="${pageNum}"]`,
      ) as HTMLElement;
      if (!el) return;

      programmaticScrollRef.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 500);
    },
    [scrollMode],
  );

  // Expose scrollToPage to parent via callback
  useEffect(() => {
    onScrollToPageReady?.(scrollToPage);
  }, [scrollToPage, onScrollToPageReady]);

  if (pageInfos.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  if (scrollMode === "single") {
    const info = pageInfos[currentPage - 1];
    if (!info) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      );
    }
    return (
      <div
        ref={containerRef}
        className="flex items-center justify-center h-full overflow-auto bg-muted/30"
      >
        <canvas
          ref={(el) => {
            if (el) canvasMapRef.current.set(currentPage, el);
          }}
          style={{
            width: info.width * zoom,
            height: info.height * zoom,
          }}
          className="shadow-lg"
        />
      </div>
    );
  }

  // Continuous scroll mode
  return (
    <div ref={containerRef} className="h-full overflow-auto bg-muted/30">
      <div className="flex flex-col items-center gap-2 py-4">
        {pageInfos.map((info, i) => {
          const pageNum = i + 1;
          const shouldRender =
            visiblePages.has(pageNum) ||
            visiblePages.has(pageNum - 1) ||
            visiblePages.has(pageNum + 1);
          return (
            <div
              key={pageNum}
              data-page-num={pageNum}
              style={{
                width: info.width * zoom,
                height: info.height * zoom,
              }}
              className="relative bg-white shadow-md shrink-0"
            >
              {shouldRender && (
                <canvas
                  ref={(el) => {
                    if (el) canvasMapRef.current.set(pageNum, el);
                  }}
                  className="absolute top-0 left-0"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
