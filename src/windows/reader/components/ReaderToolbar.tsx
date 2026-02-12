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
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <div className="flex items-center gap-1 px-3 h-10 border-b border-border shrink-0 select-none">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={onToggleSidebar}
        title="侧栏"
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
        title="缩小"
      >
        <ZoomOut className="size-4" />
      </Button>
      <button
        className="text-xs tabular-nums min-w-[3rem] text-center hover:bg-accent rounded px-1 py-0.5"
        onClick={onZoomReset}
        title="重置缩放"
      >
        {Math.round(zoom * 100)}%
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={onZoomIn}
        title="放大"
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
        {theme === "dark" ? (
          <Moon className="size-4" />
        ) : (
          <Sun className="size-4" />
        )}
      </Button>
    </div>
  );
}
