import { useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@shared/components/ui/button";
import { importPdf } from "@shared/lib/commands";
import { open } from "@tauri-apps/plugin-dialog";

interface EmptyStateProps {
  onRefresh: () => void;
}

export function EmptyState({ onRefresh }: EmptyStateProps) {
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

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
      <BookOpen className="size-16 opacity-30" />
      <div className="text-center">
        <p className="text-sm font-medium">书架为空</p>
        <p className="text-xs mt-1">导入 PDF 文件或将文件放入 iCloud 目录</p>
      </div>
      <Button variant="outline" size="sm" onClick={handleImport} disabled={importing}>
        {importing ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
        {importing ? "导入中..." : "导入 PDF"}
      </Button>
    </div>
  );
}
