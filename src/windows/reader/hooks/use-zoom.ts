import { useState, useCallback, useEffect } from "react";

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.25;

export function useZoom(initialZoom = 1.0) {
  const [zoom, setZoomState] = useState(initialZoom);

  const setZoom = useCallback((value: number | ((prev: number) => number)) => {
    setZoomState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(next * 1000) / 1000));
    });
  }, []);

  const zoomIn = useCallback(() => setZoom((z) => z + ZOOM_STEP), [setZoom]);
  const zoomOut = useCallback(() => setZoom((z) => z - ZOOM_STEP), [setZoom]);
  const resetZoom = useCallback(() => setZoom(1.0), [setZoom]);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          zoomIn();
        } else if (e.key === "-") {
          e.preventDefault();
          zoomOut();
        } else if (e.key === "0") {
          e.preventDefault();
          resetZoom();
        }
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [zoomIn, zoomOut, resetZoom]);

  return { zoom, setZoom, zoomIn, zoomOut, resetZoom };
}
