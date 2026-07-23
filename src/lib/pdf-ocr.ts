import { createCanvas, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";
// pdfjs-dist is marked as a serverExternalPackage (not bundled), so Next's
// output file tracing is what decides whether pdf.worker.mjs ships in the
// deployed function — and it only does that for files it sees statically
// imported somewhere. pdfjs itself only dynamically imports this one at
// runtime ("fake worker" — run in the same process, no real worker
// thread), which tracing can't see, so without this explicit import the
// file gets left out and getDocument() fails in production with "Setting
// up fake worker failed: Cannot find module .../pdf.worker.mjs".
import "pdfjs-dist/legacy/build/pdf.worker.mjs";
// Bundles the English trained-data file locally (~13MB) so OCR never
// depends on fetching it from the jsdelivr CDN at request time — that
// fetch is slow on serverless cold starts and can be blocked by network
// policy in some environments.
import engTrainedData from "@tesseract.js-data/eng";

class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }
  reset(canvasAndContext: { canvas: Canvas; context: SKRSContext2D }, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext: { canvas: Canvas | null; context: SKRSContext2D | null }) {
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

// How many pages to OCR concurrently. Reports run 60-90+ pages; OCR-ing
// them one at a time risks exceeding the route's maxDuration (300s) long
// before we're done. Rendering is CPU-bound and each page is independent,
// so a small worker pool cuts wall-clock time roughly by this factor.
const OCR_CONCURRENCY = 6;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function renderPageToPng(doc: any, pageNum: number): Promise<Buffer> {
  const canvasFactory = new NodeCanvasFactory();
  const page = await doc.getPage(pageNum);
  // 2x scale: PDF default is 72 DPI, this renders at ~144 DPI. Tried
  // dropping this to 1.6x to save time (route must fit inside Vercel's
  // 300s Hobby-plan ceiling), but that caused a real reparse to fail
  // reading the "UID - <value>" line — it's rendered as vector art, not
  // real text, and is apparently more sensitive to resolution than normal
  // body text. Not worth the risk: get speed from elsewhere (concurrency
  // caps, page-chunk sizing), not by degrading OCR input quality.
  const viewport = page.getViewport({ scale: 2.0 });
  const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);
  await page.render({ canvasContext: context, viewport, canvasFactory }).promise;
  const pngBuffer = canvas.toBuffer("image/png");
  canvasFactory.destroy({ canvas, context });
  return pngBuffer;
}

// Rasterizes every page of the PDF at a resolution high enough for OCR to
// read normal body text reliably, then runs OCR on each page (via a small
// pool of workers, in parallel) and concatenates the results in original
// page order with page markers so the model can still reason about
// document order/sections.
export async function extractPdfTextViaOcr(pdfBuffer: Buffer): Promise<string> {
  // pdfjs-dist v6 ships ESM-only (no CJS `pdf.js` build) — dynamic import
  // is required here. This is also the only rendering path that rasterizes
  // vector art (its own text-layer extraction API misses content rendered
  // as pure vector graphics — the exact problem that made this app switch
  // to vision-based extraction in the first place); OCR-ing the rendered
  // bitmap recovers that content as plain text instead.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await (pdfjs as any).getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  const numPages: number = doc.numPages;

  const workerOptions = { langPath: engTrainedData.langPath, gzip: engTrainedData.gzip, cachePath: "/tmp" };
  const pool = await Promise.all(
    Array.from({ length: Math.min(OCR_CONCURRENCY, numPages) }, () => createWorker("eng", 1, workerOptions))
  );

  try {
    const pageTexts: string[] = new Array(numPages);
    let nextPage = 1;
    async function runWorker(worker: Awaited<ReturnType<typeof createWorker>>) {
      while (nextPage <= numPages) {
        const pageNum = nextPage++;
        const pngBuffer = await renderPageToPng(doc, pageNum);
        const { data } = await worker.recognize(pngBuffer);
        pageTexts[pageNum - 1] = `--- Page ${pageNum} ---\n${data.text.trim()}`;
      }
    }
    await Promise.all(pool.map(runWorker));
    return pageTexts.join("\n\n");
  } finally {
    // Not calling doc.destroy() here: it's not required for correctness in
    // a one-shot serverless invocation (the process tears down right
    // after), and it threw "destroy is not a function" in production —
    // the legacy Node build's document proxy apparently doesn't expose it
    // the same way the typed API declares.
    await Promise.all(pool.map((w) => w.terminate()));
  }
}
