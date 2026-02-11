import { invoke } from "@tauri-apps/api/core";
import type { PdfInfo, OutlineItem, ReadingProgress } from "./types";

export async function scanBooks(): Promise<PdfInfo[]> {
  return invoke("scan_books");
}

export async function importPdf(sourcePath: string): Promise<PdfInfo> {
  return invoke("import_pdf", { sourcePath });
}

export async function getPdfOutline(filePath: string): Promise<OutlineItem[]> {
  return invoke("get_pdf_outline", { filePath });
}

export async function loadProgress(
  hash: string,
): Promise<ReadingProgress | null> {
  return invoke("load_progress", { hash });
}

export async function saveProgress(
  progressData: ReadingProgress,
): Promise<void> {
  return invoke("save_progress", { progressData });
}

export async function openReaderWindow(
  filePath: string,
  hash: string,
): Promise<void> {
  return invoke("open_reader_window", { filePath, hash });
}

export async function getBooksDirectory(): Promise<string> {
  return invoke("get_books_directory");
}

export async function revealInFinder(path: string): Promise<void> {
  return invoke("reveal_in_finder", { path });
}
