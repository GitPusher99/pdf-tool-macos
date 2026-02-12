import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { PdfInfo, ReadingProgress, SortKey } from "@shared/lib/types";
import { scanBooks, loadProgress } from "@shared/lib/commands";
import { onBooksChanged, onProgressChanged } from "@shared/lib/events";
import { logger } from "@shared/lib/logger";

interface BookWithProgress extends PdfInfo {
  progress?: ReadingProgress;
}

export function useBooks() {
  const [books, setBooks] = useState<BookWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const refreshIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++refreshIdRef.current;
    try {
      setLoading(true);
      const scanStart = performance.now();
      const scanned = await scanBooks();
      logger.perf(`scanBooks: ${(performance.now() - scanStart).toFixed(0)}ms, ${scanned.length} books`);
      if (id !== refreshIdRef.current) return;

      // Phase 1: show books immediately without progress
      setBooks(scanned.map((book) => ({ ...book })));
      setLoading(false);

      // Phase 2: load all progress at once, then single setBooks
      const progressStart = performance.now();
      const BATCH_SIZE = 5;
      const allProgress = new Map<string, ReadingProgress>();
      for (let i = 0; i < scanned.length; i += BATCH_SIZE) {
        if (id !== refreshIdRef.current) return;
        const batch = scanned.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (book) => {
            const progress = await loadProgress(book.hash).catch(() => null);
            return { hash: book.hash, progress: progress ?? undefined };
          }),
        );
        for (const r of results) {
          if (r.progress) allProgress.set(r.hash, r.progress);
        }
      }
      if (id !== refreshIdRef.current) return;
      logger.perf(`loadProgress: ${(performance.now() - progressStart).toFixed(0)}ms, ${allProgress.size}/${scanned.length} have progress`);
      setBooks((prev) =>
        prev.map((book) => {
          const progress = allProgress.get(book.hash);
          return progress ? { ...book, progress } : book;
        }),
      );
    } catch (err) {
      if (id !== refreshIdRef.current) return;
      console.error("Failed to scan books:", err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const unlistenPromise = onBooksChanged(() => {
      logger.debug("onBooksChanged event received, refreshing...");
      refresh();
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [refresh]);

  useEffect(() => {
    const unlistenPromise = onProgressChanged((progress) => {
      setBooks((prev) =>
        prev.map((book) =>
          book.hash === progress.hash ? { ...book, progress } : book,
        ),
      );
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const filtered = useMemo(() => {
    let result = books;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.filename.toLowerCase().includes(q),
      );
    }
    result = [...result].sort((a, b) => {
      switch (sortKey) {
        case "title":
          return a.title.localeCompare(b.title);
        case "recent":
          return (
            new Date(b.progress?.last_read || 0).getTime() -
            new Date(a.progress?.last_read || 0).getTime()
          );
        case "size":
          return b.file_size - a.file_size;
        default:
          return 0;
      }
    });
    return result;
  }, [books, search, sortKey]);

  return {
    books: filtered,
    loading,
    search,
    setSearch,
    sortKey,
    setSortKey,
    refresh,
  };
}
