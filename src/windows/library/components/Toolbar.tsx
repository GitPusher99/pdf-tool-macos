import { useState } from "react";
import { Search, Import, ArrowUpDown, Sun, Moon, Loader2 } from "lucide-react";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { importPdf, getBooksDirectory, revealInFinder } from "@shared/lib/commands";
import { useTheme } from "@shared/hooks/use-theme";
import { open } from "@tauri-apps/plugin-dialog";
import type { SortKey } from "@shared/lib/types";

interface ToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sortKey: SortKey;
  onSortChange: (key: SortKey) => void;
  onRefresh: () => void;
}

const sortLabels: Record<SortKey, string> = {
  title: "标题",
  recent: "最近阅读",
  size: "文件大小",
};

const sortCycle: SortKey[] = ["title", "recent", "size"];

export function Toolbar({
  search,
  onSearchChange,
  sortKey,
  onSortChange,
  onRefresh,
}: ToolbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (importing) return;
    const selected = await open({
      multiple: true,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!selected) return;

    setImporting(true);
    try {
      const paths = Array.isArray(selected) ? selected : [selected];
      for (const path of paths) {
        try {
          await importPdf(path);
        } catch (err) {
          console.error("Import failed:", err);
        }
      }
      onRefresh();
    } finally {
      setImporting(false);
    }
  };

  const handleCycleSort = () => {
    const idx = sortCycle.indexOf(sortKey);
    onSortChange(sortCycle[(idx + 1) % sortCycle.length]);
  };

  const handleOpenFolder = async () => {
    const dir = await getBooksDirectory();
    revealInFinder(dir);
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <div className="flex items-center gap-2 px-4 pb-3">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="搜索..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 h-8"
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCycleSort}
        title={`排序: ${sortLabels[sortKey]}`}
      >
        <ArrowUpDown className="size-4" />
        <span className="text-xs">{sortLabels[sortKey]}</span>
      </Button>
      <div className="flex-1" />
      <Button variant="ghost" size="icon" onClick={toggleTheme} className="size-8">
        {resolvedTheme === "dark" ? (
          <Moon className="size-4" />
        ) : (
          <Sun className="size-4" />
        )}
      </Button>
      <Button variant="ghost" size="sm" onClick={handleOpenFolder}>
        打开目录
      </Button>
      <Button size="sm" onClick={handleImport} disabled={importing}>
        {importing ? <Loader2 className="size-4 animate-spin" /> : <Import className="size-4" />}
        {importing ? "导入中..." : "导入"}
      </Button>
    </div>
  );
}
