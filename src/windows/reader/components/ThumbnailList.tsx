import { useRef, useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cn } from "@shared/lib/utils";

interface ThumbnailListProps {
  pdf: PDFDocumentProxy;
  pageCount: number;
  currentPage: number;
  onPageSelect: (page: number) => void;
}

const THUMB_WIDTH = 120;

export function ThumbnailList({
  pdf,
  pageCount,
  currentPage,
  onPageSelect,
}: ThumbnailListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());
  const generatedPagesRef = useRef<Set<number>>(new Set());

  // Reset generated tracking when pdf changes
  useEffect(() => {
    generatedPagesRef.current.clear();
  }, [pdf]);

  // Intersection observer for lazy loading
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setVisiblePages((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const page = Number((entry.target as HTMLElement).dataset.thumbPage);
            if (entry.isIntersecting) next.add(page);
          }
          return next;
        });
      },
      { root: container, rootMargin: "200px 0px" },
    );

    container.querySelectorAll("[data-thumb-page]").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [pageCount]);

  // Generate thumbnails for visible pages (R4: removed thumbnails from deps, use ref to track)
  useEffect(() => {
    let cancelled = false;

    async function generateThumbnails() {
      for (const pageNum of visiblePages) {
        if (generatedPagesRef.current.has(pageNum) || cancelled) continue;
        generatedPagesRef.current.add(pageNum);

        try {
          const page = await pdf.getPage(pageNum);
          const vp = page.getViewport({ scale: 1.0 });
          const scale = THUMB_WIDTH / vp.width;
          const viewport = page.getViewport({ scale });

          const canvas = new OffscreenCanvas(viewport.width, viewport.height);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ctx = canvas.getContext("2d") as any;
          await page.render({ canvasContext: ctx, viewport }).promise;

          const blob = await canvas.convertToBlob({ type: "image/png" });
          const url = URL.createObjectURL(blob);

          if (!cancelled) {
            setThumbnails((prev) => new Map(prev).set(pageNum, url));
          } else {
            URL.revokeObjectURL(url);
          }
        } catch (err) {
          console.error(`Thumbnail generation failed for page ${pageNum}:`, err);
        }
      }
    }

    generateThumbnails();
    return () => {
      cancelled = true;
    };
  }, [pdf, visiblePages]);

  // R5: Revoke all blob URLs on unmount
  useEffect(() => {
    return () => {
      for (const url of thumbnails.values()) {
        URL.revokeObjectURL(url);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to current page thumbnail
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const el = container.querySelector(
      `[data-thumb-page="${currentPage}"]`,
    ) as HTMLElement;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentPage]);

  return (
    <div ref={containerRef} className="h-full overflow-auto p-2 space-y-2">
      {Array.from({ length: pageCount }, (_, i) => {
        const pageNum = i + 1;
        const thumbUrl = thumbnails.get(pageNum);
        return (
          <button
            key={pageNum}
            data-thumb-page={pageNum}
            className={cn(
              "block w-full rounded border-2 transition-colors p-1",
              currentPage === pageNum
                ? "border-primary bg-accent"
                : "border-transparent hover:border-muted-foreground/30",
            )}
            onClick={() => onPageSelect(pageNum)}
          >
            <div
              className="w-full bg-muted rounded overflow-hidden"
              style={{ aspectRatio: "3/4" }}
            >
              {thumbUrl ? (
                <img
                  src={thumbUrl}
                  alt={`Page ${pageNum}`}
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="size-4 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-1">
              {pageNum}
            </p>
          </button>
        );
      })}
    </div>
  );
}
