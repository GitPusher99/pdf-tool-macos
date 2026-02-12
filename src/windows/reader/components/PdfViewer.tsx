import { useRef, useEffect, useLayoutEffect, useState, useCallback } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { useDragScroll } from "../hooks/use-drag-scroll";
import { usePinchZoom, type PinchScrollTarget } from "../hooks/use-pinch-zoom";
import { enqueueRender, clearRenderQueue } from "../lib/render-queue";
import { logger } from "@shared/lib/logger";

interface PdfViewerProps {
  pdf: PDFDocumentProxy;
  pageCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  zoom: number;
  setZoom: (value: number | ((prev: number) => number)) => void;
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
  setZoom,
  scrollMode,
  onScrollPositionChange,
  onScrollToPageReady,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [defaultPageInfo, setDefaultPageInfo] = useState<PageInfo | null>(null);
  const precisePageInfosRef = useRef<Map<number, PageInfo>>(new Map());
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1]));
  const renderTasksRef = useRef<Map<number, RenderTask>>(new Map());
  const canvasMapRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderedPagesRef = useRef<Set<string>>(new Set());
  const renderGenRef = useRef(0);
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
  const programmaticScrollRef = useRef(false);

  const prevZoomRef = useRef(zoom);
  const scrollTopBeforeRenderRef = useRef(0);
  const pinchScrollTargetRef = useRef<PinchScrollTarget | null>(null);

  useDragScroll(containerRef, `${scrollMode}-${!!defaultPageInfo}`);
  usePinchZoom({ containerRef, zoom, setZoom, pinchScrollTargetRef, rebindKey: `${scrollMode}-${!!defaultPageInfo}` });

  // Capture scrollTop during render phase (before DOM commit / scroll anchoring).
  if (containerRef.current) {
    scrollTopBeforeRenderRef.current = containerRef.current.scrollTop;
  }

  // Compensate scrollTop when zoom changes.
  // Pinch zoom: use cursor-based positioning from pinchScrollTargetRef.
  // Keyboard/toolbar zoom: use ratio-based compensation.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container && prevZoomRef.current !== zoom) {
      const pinchTarget = pinchScrollTargetRef.current;
      if (pinchTarget) {
        container.scrollLeft = pinchTarget.scrollLeft;
        container.scrollTop = pinchTarget.scrollTop;
        pinchScrollTargetRef.current = null;
      } else {
        const ratio = zoom / prevZoomRef.current;
        const captured = scrollTopBeforeRenderRef.current;
        const newScrollTop = captured * ratio;
        container.scrollTop = newScrollTop;
      }
    }
    prevZoomRef.current = zoom;
  }, [zoom]);

  // Load only the first page dimensions as default for all pages
  useEffect(() => {
    let cancelled = false;
    async function loadFirstPage() {
      const page = await pdf.getPage(1);
      const vp = page.getViewport({ scale: 1.0 });
      if (!cancelled) {
        setDefaultPageInfo({ width: vp.width, height: vp.height });
      }
    }
    loadFirstPage();
    return () => {
      cancelled = true;
    };
  }, [pdf]);

  // Get page info: precise if available, otherwise default
  const getPageInfo = useCallback(
    (pageNum: number): PageInfo => {
      return precisePageInfosRef.current.get(pageNum) || defaultPageInfo!;
    },
    [defaultPageInfo],
  );

  // Render a single page (queued with priority)
  const renderPage = useCallback(
    (pageNum: number) => {
      const key = `${pageNum}-${zoom}`;
      if (renderedPagesRef.current.has(key)) return;

      const priority = Math.abs(pageNum - currentPageRef.current);
      logger.debug(`renderPage request — page=${pageNum}, zoom=${zoom}, priority=${priority}`);

      const t0 = performance.now();
      const gen = renderGenRef.current;

      enqueueRender(async () => {
        // Bail out if a newer zoom generation has started
        if (gen !== renderGenRef.current) return;
        if (renderedPagesRef.current.has(key)) return;

        const canvas = canvasMapRef.current.get(pageNum);
        if (!canvas) return;

        try {
          const page: PDFPageProxy = await pdf.getPage(pageNum);
          if (gen !== renderGenRef.current) return;

          const baseViewport = page.getViewport({ scale: 1.0 });
          precisePageInfosRef.current.set(pageNum, {
            width: baseViewport.width,
            height: baseViewport.height,
          });

          const dpr = window.devicePixelRatio || 1;
          const viewport = page.getViewport({ scale: zoom * dpr });

          // Render to a temporary canvas to avoid "canvas in use" conflicts.
          // Each render gets its own canvas — no shared state, no race conditions.
          const tmpCanvas = document.createElement("canvas");
          tmpCanvas.width = viewport.width;
          tmpCanvas.height = viewport.height;
          const tmpCtx = tmpCanvas.getContext("2d")!;

          const renderTask = page.render({ canvasContext: tmpCtx, viewport });
          renderTasksRef.current.set(pageNum, renderTask);

          await renderTask.promise;
          renderTasksRef.current.delete(pageNum);

          // Final generation check before blitting
          if (gen !== renderGenRef.current) return;
          // Ensure canvas ref still points to the same element (not unmounted/remounted)
          if (canvasMapRef.current.get(pageNum) !== canvas) return;

          // Blit completed render to the visible canvas (synchronous, no race)
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${viewport.width / dpr}px`;
          canvas.style.height = `${viewport.height / dpr}px`;
          canvas.getContext("2d")!.drawImage(tmpCanvas, 0, 0);

          renderedPagesRef.current.add(key);
          logger.perf(`page ${pageNum} rendered — ${(performance.now() - t0).toFixed(1)}ms (incl. queue wait)`);
        } catch (err: unknown) {
          if (err && typeof err === "object" && "name" in err && (err as { name: string }).name !== "RenderingCancelledException") {
            logger.error(`Failed to render page ${pageNum}:`, err);
          }
        }
      }, priority);
    },
    [pdf, zoom],
  );

  // Clear render cache and queue when zoom changes
  useEffect(() => {
    renderGenRef.current++;
    clearRenderQueue();
    // Cancel all running render tasks so they release their canvases
    for (const [, task] of renderTasksRef.current) {
      task.cancel();
    }
    renderTasksRef.current.clear();
    renderedPagesRef.current.clear();
  }, [zoom]);

  // Continuous scroll: observe visible pages
  useEffect(() => {
    if (scrollMode !== "continuous" || !defaultPageInfo) return;

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
        rootMargin: "100px 0px",
        threshold: 0.01,
      },
    );

    const pageElements = container.querySelectorAll("[data-page-num]");
    pageElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [scrollMode, defaultPageInfo, zoom]);

  // Render visible pages (rootMargin + shouldRender ±1 already provides buffer)
  useEffect(() => {
    if (scrollMode !== "continuous") return;
    clearRenderQueue();
    logger.debug(`visiblePages changed — pages=[${[...visiblePages].sort((a, b) => a - b).join(", ")}]`);
    for (const pageNum of visiblePages) {
      renderPage(pageNum);
    }
  }, [visiblePages, scrollMode, renderPage]);

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

  if (!defaultPageInfo) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  if (scrollMode === "single") {
    const info = getPageInfo(currentPage);
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
    <div ref={containerRef} className="h-full overflow-auto bg-muted/30" style={{ overflowAnchor: "none" }}>
      <div className="flex flex-col items-center gap-2 py-4">
        {Array.from({ length: pageCount }, (_, i) => {
          const pageNum = i + 1;
          const info = getPageInfo(pageNum);
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
                    if (el) {
                      canvasMapRef.current.set(pageNum, el);
                    } else {
                      canvasMapRef.current.delete(pageNum);
                      renderedPagesRef.current.delete(`${pageNum}-${zoom}`);
                    }
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
