import type { PdfInfo, ReadingProgress } from "@shared/lib/types";
import { BookCard } from "./BookCard";

interface BookGridProps {
  books: (PdfInfo & { progress?: ReadingProgress })[];
}

export function BookGrid({ books }: BookGridProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 p-4 pt-0">
      {books.map((book) => (
        <BookCard key={book.hash} book={book} />
      ))}
    </div>
  );
}
