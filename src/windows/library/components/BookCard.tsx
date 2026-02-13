import { useRef, useState, useEffect } from "react";
import { Progress } from "@shared/components/ui/progress";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@shared/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@shared/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shared/components/ui/dialog";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Label } from "@shared/components/ui/label";
import { useThumbnail } from "../hooks/use-thumbnail";
import {
  openReaderWindow,
  revealInFinder,
  deletePdf,
  renamePdf,
} from "@shared/lib/commands";
import type { PdfInfo, ReadingProgress } from "@shared/lib/types";
import { FileText } from "lucide-react";
import { logger } from "@shared/lib/logger";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { translateError } from "@shared/lib/error-codes";

interface BookCardProps {
  book: PdfInfo & { progress?: ReadingProgress };
}

export function BookCard({ book }: BookCardProps) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameError, setRenameError] = useState("");
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

  const handleOpen = async () => {
    try {
      await openReaderWindow(book.path, book.hash);
    } catch (e) {
      toast.error(translateError(String(e)));
    }
  };

  const handleDelete = async () => {
    try {
      await deletePdf(book.path, book.hash);
      setDeleteOpen(false);
    } catch (e) {
      logger.error(`Failed to delete ${book.title}:`, e);
      setDeleteError(translateError(String(e)));
    }
  };

  const handleRenameOpen = () => {
    // Pre-fill with filename without .pdf extension
    const nameWithoutExt = book.filename.replace(/\.pdf$/i, "");
    setNewName(nameWithoutExt);
    setRenameError("");
    setRenameOpen(true);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setRenameError(t("library:filenameEmpty"));
      return;
    }
    try {
      await renamePdf(book.path, trimmed);
      setRenameOpen(false);
    } catch (err) {
      setRenameError(translateError(String(err)));
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={cardRef}
            className="group flex flex-col cursor-pointer rounded-lg p-2 transition-colors hover:bg-accent"
            onDoubleClick={handleOpen}
            title={t("library:bookTooltip", { title: book.title, count: book.page_count })}
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-muted mb-2 border border-border">
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
              {t("pageCount", { count: book.page_count })}
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
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={handleRenameOpen}>{t("rename")}</ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              setDeleteError("");
              setDeleteOpen(true);
            }}
            className="text-destructive focus:text-destructive"
          >
            {t("delete")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => revealInFinder(book.path)}>
            {t("library:revealInFinder")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("library:confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("library:confirmDeleteDescription", { title: book.title })}
            </AlertDialogDescription>
            {deleteError && (
              <p className="text-sm text-destructive mt-2">{deleteError}</p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <form onSubmit={handleRenameSubmit}>
            <DialogHeader>
              <DialogTitle>{t("library:renameTitle")}</DialogTitle>
              <DialogDescription>
                {t("library:renameDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="new-name">{t("library:filenameLabel")}</Label>
                <Input
                  id="new-name"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setRenameError("");
                  }}
                  autoFocus
                />
                {renameError && (
                  <p className="text-sm text-destructive">{renameError}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit">{t("confirm")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
