import { useEffect, useRef, type RefObject } from "react";
import { MIN_ZOOM, MAX_ZOOM } from "./use-zoom";

const ZOOM_SENSITIVITY = 0.005;

/** WebKit-specific gesture event (macOS Safari / WKWebView) */
interface GestureEvent extends UIEvent {
  scale: number;
  clientX: number;
  clientY: number;
}

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

  // --- Chromium ctrl+wheel pinch zoom ---
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

  // --- WebKit gesture pinch zoom (macOS WKWebView) ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Zoom value captured at gesturestart, used as base for gesturechange
    let baseZoom = 1;

    const handleGestureStart = (e: Event) => {
      e.preventDefault();
      baseZoom = zoomRef.current;
    };

    const handleGestureChange = (e: Event) => {
      e.preventDefault();
      const ge = e as unknown as GestureEvent;

      const rect = container.getBoundingClientRect();
      const cursorX = ge.clientX - rect.left;
      const cursorY = ge.clientY - rect.top;

      const contentX = container.scrollLeft + cursorX;
      const contentY = container.scrollTop + cursorY;

      const oldZoom = zoomRef.current;
      const newZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, baseZoom * ge.scale),
      );

      if (newZoom === oldZoom) return;

      setZoom(newZoom);

      requestAnimationFrame(() => {
        const scale = newZoom / oldZoom;
        container.scrollLeft = contentX * scale - cursorX;
        container.scrollTop = contentY * scale - cursorY;
      });
    };

    const handleGestureEnd = (e: Event) => {
      e.preventDefault();
    };

    container.addEventListener("gesturestart", handleGestureStart);
    container.addEventListener("gesturechange", handleGestureChange);
    container.addEventListener("gestureend", handleGestureEnd);
    return () => {
      container.removeEventListener("gesturestart", handleGestureStart);
      container.removeEventListener("gesturechange", handleGestureChange);
      container.removeEventListener("gestureend", handleGestureEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, setZoom, rebindKey]);
}
