import { useEffect, useRef, useCallback } from "react";
import {
  loadProgress,
  saveProgress as saveProgressCmd,
} from "@shared/lib/commands";
import type { ReadingProgress } from "@shared/lib/types";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface UseReadingProgressOptions {
  hash: string;
  pageCount: number;
  currentPage: number;
  zoom: number;
  scrollMode: "continuous" | "single";
  scrollPosition: number;
  onRestore: (progress: ReadingProgress) => void;
}

export function useReadingProgress({
  hash,
  pageCount,
  currentPage,
  zoom,
  scrollMode,
  scrollPosition,
  onRestore,
}: UseReadingProgressOptions) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  const doSave = useCallback(async () => {
    if (!hash || pageCount === 0) return;

    const progress: ReadingProgress = {
      hash,
      current_page: currentPage,
      total_pages: pageCount,
      zoom,
      scroll_mode: scrollMode,
      scroll_position: scrollPosition,
      last_read: new Date().toISOString(),
    };

    // Compare excluding last_read for dedup
    const { last_read: _, ...comparable } = progress;
    const key = JSON.stringify(comparable);
    if (key === lastSavedRef.current) return;
    lastSavedRef.current = key;

    try {
      await saveProgressCmd(progress);
    } catch (err) {
      console.error("Failed to save progress:", err);
    }
  }, [hash, pageCount, currentPage, zoom, scrollMode, scrollPosition]);

  const doSaveRef = useRef(doSave);
  useEffect(() => {
    doSaveRef.current = doSave;
  }, [doSave]);

  // Load progress on mount
  useEffect(() => {
    if (!hash) return;
    loadProgress(hash)
      .then((progress) => {
        if (progress) onRestore(progress);
      })
      .catch((err) => console.error("Failed to load progress:", err));
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  // Debounced save on page/zoom changes
  useEffect(() => {
    if (!hash) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(doSave, 1000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [hash, currentPage, zoom, doSave]);

  // Periodic save every 30s
  useEffect(() => {
    if (!hash) return;
    const interval = setInterval(doSave, 30000);
    return () => clearInterval(interval);
  }, [hash, doSave]);

  // Save on window close
  useEffect(() => {
    if (!hash) return;
    const appWindow = getCurrentWindow();
    const unlistenPromise = appWindow.onCloseRequested(async () => {
      await doSaveRef.current();
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [hash]);
}
