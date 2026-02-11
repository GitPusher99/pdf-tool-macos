import { useState, useEffect, useCallback, useMemo } from "react";
import type { PdfInfo, ReadingProgress, SortKey } from "@shared/lib/types";
import { scanBooks, loadProgress } from "@shared/lib/commands";
import { onBooksChanged } from "@shared/lib/events";

interface BookWithProgress extends PdfInfo {
  progress?: ReadingProgress;
}

export function useBooks() {
  const [books, setBooks] = useState<BookWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("title");

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const scanned = await scanBooks();
      const withProgress = await Promise.all(
        scanned.map(async (book) => {
          const progress = await loadProgress(book.hash).catch(() => null);
          return { ...book, progress: progress ?? undefined };
        }),
      );
      setBooks(withProgress);
    } catch (err) {
      console.error("Failed to scan books:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const unlistenPromise = onBooksChanged(() => refresh());
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [refresh]);

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
