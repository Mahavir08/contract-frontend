"use client";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui";

// Renders a PDF with PDF.js instead of the browser's native viewer.
// Native inline viewers (<object>/<iframe>) don't exist on mobile browsers and
// are unreliable with blob URLs on desktop (e.g. Windows Chrome downloads the
// file instead of rendering it), so we rasterise each page to a canvas — the
// same bytes render identically on every platform.
export function PdfViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Track the container width (rounded to avoid re-render churn) so pages
  // re-rasterise on window resize / phone rotation.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!width) return;
    let cancelled = false;
    let task: { destroy(): Promise<void> } | null = null;

    (async () => {
      setStatus("loading");
      try {
        // Dynamic import: PDF.js touches browser APIs, so keep it out of SSR.
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const loadingTask = pdfjs.getDocument({ url });
        task = loadingTask;
        const loaded = await loadingTask.promise;
        if (cancelled) return;

        const pages = pagesRef.current;
        if (!pages) return;
        pages.replaceChildren();
        // Cap the pixel ratio: retina crispness without huge canvases.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let n = 1; n <= loaded.numPages; n++) {
          const page = await loaded.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "mb-3 w-full rounded border border-gray-200 bg-white shadow-sm";
          pages.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
        }
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      task?.destroy();
    };
  }, [url, width]);

  return (
    <div ref={containerRef} className="h-full overflow-y-auto bg-gray-100 p-3">
      {status === "loading" && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Spinner className="h-6 w-6" />
        </div>
      )}
      {status === "error" && (
        <p className="py-16 text-center text-sm text-gray-500">
          Could not render this PDF. Use the link below to open it directly.
        </p>
      )}
      <div ref={pagesRef} className={status === "error" ? "hidden" : undefined} />
    </div>
  );
}
