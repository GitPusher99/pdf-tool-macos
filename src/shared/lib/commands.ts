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

export async function deletePdf(
  filePath: string,
  hash: string,
): Promise<void> {
  return invoke("delete_pdf", { filePath, hash });
}

export async function renamePdf(
  filePath: string,
  newFilename: string,
): Promise<void> {
  return invoke("rename_pdf", { filePath, newFilename });
}

export async function syncProgress(
  hash: string,
): Promise<ReadingProgress | null> {
  return invoke("sync_progress", { hash });
}

export async function syncAllProgress(
  hashes: string[],
): Promise<ReadingProgress[]> {
  return invoke("sync_all_progress", { hashes });
}

export async function isDebugEnabled(): Promise<boolean> {
  return invoke<boolean>("is_debug_enabled");
}

export async function getSystemLocale(): Promise<string> {
  return invoke<string>("get_system_locale");
}
