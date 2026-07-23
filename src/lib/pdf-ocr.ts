import { createCanvas, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";
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

// Rasterizes every page of the PDF at a resolution high enough for OCR to
// read normal body text reliably, then runs OCR on each page and
// concatenates the results with page markers so the model can still
// reason about document order/sections.
export async function extractPdfTextViaOcr(pdfBuffer: Buffer): Promise<string> {
  // pdfjs-dist v6 ships ESM-only (no CJS `pdf.js` build) — dynamic import
  // is required here. This is also the only rendering path that rasterizes
  // vector art (its own text-layer extraction API misses content rendered
  // as pure vector graphics — the exact problem that made this app switch
  // to vision-based extraction in the first place); OCR-ing the rendered
  // bitmap recovers that content as plain text instead.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  const canvasFactory = new NodeCanvasFactory();

  const worker = await createWorker("eng", 1, {
    langPath: engTrainedData.langPath,
    gzip: engTrainedData.gzip,
    cachePath: "/tmp",
  });
  try {
    const pageTexts: string[] = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      // 2x scale: PDF default is 72 DPI, this renders at ~144 DPI, which
      // OCR needs for small body text to come out accurately.
      const viewport = page.getViewport({ scale: 2.0 });
      const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);

      await page.render({
        canvasContext: context,
        viewport,
        canvasFactory,
      }).promise;

      const pngBuffer = canvas.toBuffer("image/png");
      const { data } = await worker.recognize(pngBuffer);
      pageTexts.push(`--- Page ${pageNum} ---\n${data.text.trim()}`);

      canvasFactory.destroy({ canvas, context });
    }
    return pageTexts.join("\n\n");
  } finally {
    await worker.terminate();
  }
}
