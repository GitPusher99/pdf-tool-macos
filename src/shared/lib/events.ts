import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ReadingProgress } from "./types";

export function onBooksChanged(callback: () => void): Promise<UnlistenFn> {
  return listen("books:changed", callback);
}

export function onProgressChanged(
  callback: (progress: ReadingProgress) => void,
): Promise<UnlistenFn> {
  return listen<ReadingProgress>("progress:changed", (event) => {
    callback(event.payload);
  });
}
