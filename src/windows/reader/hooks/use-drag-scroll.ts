import { useEffect, type RefObject } from "react";

export function useDragScroll(
  containerRef: RefObject<HTMLElement | null>,
  /** Extra deps that signal when the underlying DOM element changes */
  rebindKey?: unknown,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;

    container.style.cursor = "grab";

    const handleMouseDown = (e: MouseEvent) => {
      // Ignore clicks on interactive elements
      const target = e.target as HTMLElement;
      if (target.closest("button, input, select, textarea, a")) return;
      if (e.button !== 0) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      scrollLeft = container.scrollLeft;
      scrollTop = container.scrollTop;
      container.style.cursor = "grabbing";
      container.style.userSelect = "none";
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      container.scrollLeft = scrollLeft - dx;
      container.scrollTop = scrollTop - dy;
    };

    const handleMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      container.style.cursor = "grab";
      container.style.userSelect = "";
    };

    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      container.style.cursor = "";
      container.style.userSelect = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, rebindKey]);
}
