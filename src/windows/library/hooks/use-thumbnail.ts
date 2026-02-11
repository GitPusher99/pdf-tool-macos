import { useState, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import * as pdfjsLib from "pdfjs-dist";

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
const MAX_CONCURRENT = 3;
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

export function useThumbnail(filePath: string, hash: string) {
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

    let cancelled = false;

    enqueue(async () => {
      if (cancelled) return;
      try {
        const src = convertFileSrc(filePath);
        const pdf = await pdfjsLib.getDocument(src).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 });

        const canvas = new OffscreenCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext("2d")!;

        await page.render({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          canvasContext: ctx as any,
          viewport,
        }).promise;

        const blob = await canvas.convertToBlob({ type: "image/png" });
        const dataUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          addToCache(hash, dataUrl);
          setUrl(dataUrl);
        } else {
          URL.revokeObjectURL(dataUrl);
        }

        pdf.destroy();
      } catch (err) {
        console.error("Failed to generate thumbnail:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [filePath, hash]);

  return { url, loading };
}
