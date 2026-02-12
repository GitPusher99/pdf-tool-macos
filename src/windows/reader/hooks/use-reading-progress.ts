import { useEffect, useRef, useCallback } from "react";
import {
  loadProgress,
  saveProgress as saveProgressCmd,
  syncProgress,
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
      version: 0, // Backend auto-increments
    };

    // Compare excluding last_read for dedup
    const { last_read: _, ...comparable } = progress;
    const key = JSON.stringify(comparable);
    if (key === lastSavedRef.current) {
      console.warn(`[SYNC] save: page=${currentPage}, zoom=${zoom} (dedup skipped)`);
      return;
    }
    lastSavedRef.current = key;

    try {
      await saveProgressCmd(progress);
      console.warn(`[SYNC] save: page=${currentPage}, zoom=${zoom}, hash=${hash.slice(0, 8)} (saved)`);
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
        console.warn(`[SYNC] load: hash=${hash.slice(0, 8)}, result=${progress ? `{page:${progress.current_page}, zoom:${progress.zoom}, version:${progress.version}}` : "null"}`);
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

  // Periodic save every 30s (use ref to avoid interval reset on doSave change)
  useEffect(() => {
    if (!hash) return;
    const interval = setInterval(() => doSaveRef.current(), 30000);
    return () => clearInterval(interval);
  }, [hash]);

  // Sync with central (iCloud) every 2s
  const onRestoreRef = useRef(onRestore);
  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  useEffect(() => {
    if (!hash) return;
    const interval = setInterval(async () => {
      try {
        const pulled = await syncProgress(hash);
        console.warn(`[SYNC] sync: hash=${hash.slice(0, 8)}, pulled=${pulled ? `{page:${pulled.current_page}, zoom:${pulled.zoom}, version:${pulled.version}}` : "null"}`);
        if (pulled) {
          onRestoreRef.current(pulled);
          // Update dedup cache to prevent unnecessary save after restore
          const { last_read: _, ...comparable } = { ...pulled, version: 0 };
          lastSavedRef.current = JSON.stringify(comparable);
        }
      } catch {
        // Sync failure is non-critical, retry next interval
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [hash]);

  // Save and sync on window close
  useEffect(() => {
    if (!hash) return;
    const appWindow = getCurrentWindow();
    const unlistenPromise = appWindow.onCloseRequested(async () => {
      console.warn(`[SYNC] close: saving and syncing, hash=${hash.slice(0, 8)}`);
      await doSaveRef.current();
      try {
        const pulled = await syncProgress(hash);
        console.warn(`[SYNC] close-sync: pulled=${pulled ? `{page:${pulled.current_page}, version:${pulled.version}}` : "null"}`);
      } catch {
        // Sync failure on close is non-critical
      }
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [hash]);
}
