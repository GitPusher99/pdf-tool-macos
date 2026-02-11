import { isDebugEnabled } from "./commands";

let enabled =
  new URLSearchParams(window.location.search).get("debug") === "1" ||
  localStorage.getItem("pdf-debug") === "1";

export async function initLogger() {
  if (!enabled) {
    try {
      enabled = await isDebugEnabled();
    } catch (e) {
      console.warn("[PDF] Failed to check debug flag:", e);
    }
  }
  if (enabled) {
    console.log("[PDF] Debug logging enabled");
  }
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (enabled) console.log("[PDF]", ...args);
  },
  perf: (...args: unknown[]) => {
    if (enabled) console.log("[PERF]", ...args);
  },
  warn: (...args: unknown[]) => console.warn("[PDF]", ...args),
  error: (...args: unknown[]) => console.error("[PDF]", ...args),
  get enabled() {
    return enabled;
  },
};
