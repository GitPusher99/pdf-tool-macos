import { useState, useEffect } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { OutlineItem } from "@shared/lib/types";
import { getPdfOutline } from "@shared/lib/commands";
import { ThumbnailList } from "./ThumbnailList";
import { OutlineTree } from "./OutlineTree";
import { cn } from "@shared/lib/utils";
import { useTranslation } from "react-i18next";

type SidebarTab = "thumbnails" | "outline";

interface SidebarProps {
  pdf: PDFDocumentProxy;
  pageCount: number;
  currentPage: number;
  onPageSelect: (page: number) => void;
  filePath: string;
}

export function Sidebar({
  pdf,
  pageCount,
  currentPage,
  onPageSelect,
  filePath,
}: SidebarProps) {
  const { t } = useTranslation("reader");
  const [tab, setTab] = useState<SidebarTab>("thumbnails");
  const [outline, setOutline] = useState<OutlineItem[]>([]);

  useEffect(() => {
    getPdfOutline(filePath)
      .then(setOutline)
      .catch((err) => console.error("Failed to load outline:", err));
  }, [filePath]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border shrink-0">
        <button
          className={cn(
            "flex-1 py-1.5 text-xs text-center transition-colors",
            tab === "thumbnails"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setTab("thumbnails")}
        >
          {t("thumbnails")}
        </button>
        <button
          className={cn(
            "flex-1 py-1.5 text-xs text-center transition-colors",
            tab === "outline"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setTab("outline")}
        >
          {t("outline")}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === "thumbnails" ? (
          <ThumbnailList
            pdf={pdf}
            pageCount={pageCount}
            currentPage={currentPage}
            onPageSelect={onPageSelect}
          />
        ) : (
          <div className="h-full overflow-auto">
            <OutlineTree
              items={outline}
              onPageSelect={onPageSelect}
              currentPage={currentPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
