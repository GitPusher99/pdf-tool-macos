import {
  PanelLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@shared/components/ui/button";
import { useTheme } from "@shared/hooks/use-theme";
import { useTranslation } from "react-i18next";

interface ReaderToolbarProps {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function ReaderToolbar({
  currentPage,
  pageCount,
  onPageChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  sidebarOpen: _sidebarOpen,
  onToggleSidebar,
}: ReaderToolbarProps) {
  const { t } = useTranslation("reader");
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <div className="flex items-center gap-1 px-3 h-10 border-b border-border shrink-0 select-none">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={onToggleSidebar}
        title={t("sidebar")}
      >
        <PanelLeft className="size-4" />
      </Button>

      <div className="w-px h-4 bg-border mx-1 pointer-events-none" />

      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage <= 1}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="text-xs tabular-nums min-w-[4rem] text-center pointer-events-none">
        {currentPage} / {pageCount}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
        disabled={currentPage >= pageCount}
      >
        <ChevronRight className="size-4" />
      </Button>

      <div className="w-px h-4 bg-border mx-1 pointer-events-none" />

      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={onZoomOut}
        title={t("zoomOut")}
      >
        <ZoomOut className="size-4" />
      </Button>
      <button
        className="text-xs tabular-nums min-w-[3rem] text-center hover:bg-accent rounded px-1 py-0.5"
        onClick={onZoomReset}
        title={t("resetZoom")}
      >
        {Math.round(zoom * 100)}%
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={onZoomIn}
        title={t("zoomIn")}
      >
        <ZoomIn className="size-4" />
      </Button>

      <div className="flex-1 pointer-events-none" />

      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={toggleTheme}
      >
        {resolvedTheme === "dark" ? (
          <Moon className="size-4" />
        ) : (
          <Sun className="size-4" />
        )}
      </Button>
    </div>
  );
}
