export interface PdfInfo {
  path: string;
  filename: string;
  title: string;
  page_count: number;
  hash: string;
  file_size: number;
}

export interface OutlineItem {
  title: string;
  page: number;
  children: OutlineItem[];
}

export interface ReadingProgress {
  hash: string;
  current_page: number;
  total_pages: number;
  zoom: number;
  scroll_mode: "continuous" | "single";
  scroll_position: number;
  last_read: string;
  version: number;
}

export type SortKey = "title" | "recent" | "size";
export type SortOrder = "asc" | "desc";
