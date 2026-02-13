import { useBooks } from "./hooks/use-books";
import { Toolbar } from "./components/Toolbar";
import { BookGrid } from "./components/BookGrid";
import { EmptyState } from "./components/EmptyState";
import { ScrollArea } from "@shared/components/ui/scroll-area";
import { Toaster } from "sonner";

export default function App() {
  const { books, loading, search, setSearch, sortKey, setSortKey, refresh } =
    useBooks();

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <div
        data-tauri-drag-region
        className="h-12 flex items-center px-4 select-none shrink-0"
      >
        <h1 className="text-sm font-semibold pl-16 pointer-events-none">PDF Reader</h1>
      </div>

      <Toolbar
        search={search}
        onSearchChange={setSearch}
        sortKey={sortKey}
        onSortChange={setSortKey}
        onRefresh={refresh}
      />

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        ) : books.length === 0 ? (
          <EmptyState onRefresh={refresh} />
        ) : (
          <BookGrid books={books} />
        )}
      </ScrollArea>
      <Toaster position="bottom-center" richColors />
    </div>
  );
}
