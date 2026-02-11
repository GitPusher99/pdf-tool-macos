import { useEffect, useRef, type RefObject } from "react";
import { MIN_ZOOM, MAX_ZOOM } from "./use-zoom";

const ZOOM_SENSITIVITY = 0.005;

interface UsePinchZoomOptions {
  containerRef: RefObject<HTMLElement | null>;
  zoom: number;
  setZoom: (value: number | ((prev: number) => number)) => void;
  /** Extra deps that signal when the underlying DOM element changes */
  rebindKey?: unknown;
}

export function usePinchZoom({
  containerRef,
  zoom,
  setZoom,
  rebindKey,
}: UsePinchZoomOptions) {
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;

      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      // Content position under cursor before zoom
      const contentX = container.scrollLeft + cursorX;
      const contentY = container.scrollTop + cursorY;

      const oldZoom = zoomRef.current;
      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      const newZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, oldZoom * (1 + delta)),
      );

      if (newZoom === oldZoom) return;

      setZoom(newZoom);

      // Adjust scroll to keep content under cursor stationary
      requestAnimationFrame(() => {
        const scale = newZoom / oldZoom;
        container.scrollLeft = contentX * scale - cursorX;
        container.scrollTop = contentY * scale - cursorY;
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, setZoom, rebindKey]);
}
