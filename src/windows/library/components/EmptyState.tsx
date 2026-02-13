import { useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@shared/components/ui/button";
import { importPdf } from "@shared/lib/commands";
import { open } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import { translateError } from "@shared/lib/error-codes";
import { toast } from "sonner";

interface EmptyStateProps {
  onRefresh: () => void;
}

export function EmptyState({ onRefresh }: EmptyStateProps) {
  const { t } = useTranslation();
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
          toast.error(translateError(String(err)));
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
        <p className="text-sm font-medium">{t("library:emptyTitle")}</p>
        <p className="text-xs mt-1">{t("library:emptyDescription")}</p>
      </div>
      <Button variant="outline" size="sm" onClick={handleImport} disabled={importing}>
        {importing ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
        {importing ? t("importing") : t("library:importPdf")}
      </Button>
    </div>
  );
}
