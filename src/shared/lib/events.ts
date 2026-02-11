import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export function onBooksChanged(callback: () => void): Promise<UnlistenFn> {
  return listen("books:changed", callback);
}
