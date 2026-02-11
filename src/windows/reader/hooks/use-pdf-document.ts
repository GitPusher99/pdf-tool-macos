import { useState, useEffect, useRef } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { logger } from "@shared/lib/logger";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();

export function usePdfDocument() {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);

  // Parse URL params
  const params = new URLSearchParams(window.location.search);
  const filePath = decodeURIComponent(params.get("path") || "");
  const hash = params.get("hash") || "";

  useEffect(() => {
    if (!filePath) {
      setError("No file path provided");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPdf() {
      try {
        logger.debug(`PDF loading — path=${filePath}`);
        const t0 = performance.now();
        const src = convertFileSrc(filePath);
        const doc = await pdfjsLib.getDocument({
          url: src,
          disableAutoFetch: true,
          disableStream: true,
        }).promise;
        if (!cancelled) {
          pdfRef.current = doc;
          setPdf(doc);
          setPageCount(doc.numPages);
          logger.perf(`PDF loaded — ${doc.numPages} pages, ${(performance.now() - t0).toFixed(1)}ms`);
        }
      } catch (err) {
        if (!cancelled) {
          setError(`Failed to load PDF: ${err}`);
          logger.error(`PDF load failed — ${err}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
      pdfRef.current?.destroy();
    };
  }, [filePath]);

  return { pdf, pageCount, loading, error, filePath, hash };
}
