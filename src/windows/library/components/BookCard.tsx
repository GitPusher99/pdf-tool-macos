import { useRef, useState, useEffect } from "react";
import { Progress } from "@shared/components/ui/progress";
import { useThumbnail } from "../hooks/use-thumbnail";
import { openReaderWindow, revealInFinder } from "@shared/lib/commands";
import type { PdfInfo, ReadingProgress } from "@shared/lib/types";
import { FileText } from "lucide-react";
import { logger } from "@shared/lib/logger";

interface BookCardProps {
  book: PdfInfo & { progress?: ReadingProgress };
}

export function BookCard({ book }: BookCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const renderCount = useRef(0);
  renderCount.current++;
  logger.debug(`BookCard render #${renderCount.current}: ${book.title}`);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { url: thumbnailUrl, loading } = useThumbnail(
    book.path,
    book.hash,
    visible,
  );

  const progressPercent = book.progress
    ? Math.round(
        (book.progress.current_page / Math.max(1, book.progress.total_pages)) *
          100,
      )
    : 0;

  const handleOpen = () => {
    openReaderWindow(book.path, book.hash);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    revealInFinder(book.path);
  };

  return (
    <div
      ref={cardRef}
      className="group flex flex-col cursor-pointer rounded-lg p-2 transition-colors hover:bg-accent"
      onDoubleClick={handleOpen}
      onContextMenu={handleContextMenu}
      title={`${book.title}\n${book.page_count} 页`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-muted mb-2">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={book.title}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <FileText className="size-12" />
          </div>
        )}
      </div>
      <p className="text-xs font-medium truncate" title={book.title}>
        {book.title}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">
        {book.page_count} 页
      </p>
      {book.progress && book.progress.current_page > 1 && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <Progress value={progressPercent} className="flex-1" />
          <span className="text-[10px] text-muted-foreground">
            {progressPercent}%
          </span>
        </div>
      )}
    </div>
  );
}
