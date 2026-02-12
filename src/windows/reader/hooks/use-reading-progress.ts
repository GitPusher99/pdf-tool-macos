import { useEffect, useRef, useCallback } from "react";
import {
  loadProgress,
  saveProgress as saveProgressCmd,
  syncProgress,
} from "@shared/lib/commands";
import type { ReadingProgress } from "@shared/lib/types";
import { getCurrentWindow } from "@tauri-apps/api/window";

function dedupKey(p: ReadingProgress): string {
  const { last_read: _, scroll_position: _sp, ...rest } = { ...p, version: 0 };
  return JSON.stringify(rest);
}

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
  const lastRestoreRef = useRef(0);
  const scrollPositionRef = useRef(scrollPosition);
  scrollPositionRef.current = scrollPosition;

  const doSave = useCallback(async () => {
    if (!hash || pageCount === 0) return;

    const progress: ReadingProgress = {
      hash,
      current_page: currentPage,
      total_pages: pageCount,
      zoom,
      scroll_mode: scrollMode,
      scroll_position: scrollPositionRef.current,
      last_read: new Date().toISOString(),
      version: 0, // Backend auto-increments
    };

    // Post-restore cooldown: skip save within 3s after sync restore
    const timeSinceRestore = Date.now() - lastRestoreRef.current;
    if (timeSinceRestore < 3000) {
      console.warn(`[SYNC] save: page=${currentPage} (post-restore cooldown ${timeSinceRestore}ms, skipped)`);
      return;
    }

    const key = dedupKey(progress);
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
  }, [hash, pageCount, currentPage, zoom, scrollMode]);

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
        if (progress) {
          onRestore(progress);
          lastSavedRef.current = dedupKey(progress);
        }
      })
      .catch((err) => console.error("Failed to load progress:", err));
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  // Debounced save on page/zoom changes
  useEffect(() => {
    if (!hash) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => doSaveRef.current(), 1000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, currentPage, zoom]);

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
          lastRestoreRef.current = Date.now();
          onRestoreRef.current(pulled);
          lastSavedRef.current = dedupKey(pulled);
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
      lastRestoreRef.current = 0; // Clear cooldown to ensure close save is not skipped
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
