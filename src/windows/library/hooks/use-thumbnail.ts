import { useState, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import * as pdfjsLib from "pdfjs-dist";
import { logger } from "@shared/lib/logger";

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();

const MAX_CACHE_SIZE = 100;
const thumbnailCache = new Map<string, string>();

function addToCache(key: string, url: string) {
  if (thumbnailCache.size >= MAX_CACHE_SIZE) {
    const firstKey = thumbnailCache.keys().next().value!;
    const oldUrl = thumbnailCache.get(firstKey)!;
    URL.revokeObjectURL(oldUrl);
    thumbnailCache.delete(firstKey);
  }
  thumbnailCache.set(key, url);
}

// Concurrency queue to avoid spawning too many PDF.js instances at once
const MAX_CONCURRENT = 1;
let running = 0;
const queue: (() => void)[] = [];

function enqueue(fn: () => Promise<void>): Promise<void> {
  return new Promise<void>((resolve) => {
    const run = async () => {
      running++;
      try {
        await fn();
      } finally {
        running--;
        resolve();
        if (queue.length > 0) queue.shift()!();
      }
    };
    if (running < MAX_CONCURRENT) run();
    else queue.push(run);
  });
}

export function useThumbnail(
  filePath: string,
  hash: string,
  visible: boolean,
) {
  const [url, setUrl] = useState<string | null>(
    thumbnailCache.get(hash) ?? null,
  );
  const [loading, setLoading] = useState(!thumbnailCache.has(hash));

  useEffect(() => {
    if (thumbnailCache.has(hash)) {
      setUrl(thumbnailCache.get(hash)!);
      setLoading(false);
      return;
    }

    if (!visible) return;

    let cancelled = false;

    logger.debug(`thumbnail enqueue: ${filePath.split("/").pop()}, queued=${queue.length}, running=${running}`);

    enqueue(async () => {
      if (cancelled) return;
      const totalStart = performance.now();
      const name = filePath.split("/").pop() ?? filePath;
      try {
        const src = convertFileSrc(filePath);
        const loadStart = performance.now();
        const pdf = await pdfjsLib.getDocument({
          url: src,
          disableAutoFetch: true,
          disableStream: true,
        }).promise;
        const loadMs = performance.now() - loadStart;

        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 });

        const canvas = new OffscreenCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext("2d")!;

        const renderStart = performance.now();
        await page.render({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          canvasContext: ctx as any,
          viewport,
        }).promise;
        const renderMs = performance.now() - renderStart;

        const blob = await canvas.convertToBlob({ type: "image/png" });
        const dataUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          addToCache(hash, dataUrl);
          setUrl(dataUrl);
        } else {
          URL.revokeObjectURL(dataUrl);
        }

        pdf.destroy();
        logger.perf(`thumbnail ${name}: load=${loadMs.toFixed(0)}ms, render=${renderMs.toFixed(0)}ms, total=${(performance.now() - totalStart).toFixed(0)}ms`);
      } catch (err) {
        logger.error(`Failed to generate thumbnail for ${name}:`, err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [filePath, hash, visible]);

  return { url, loading };
}
