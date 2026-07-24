import { renderPageAsImage } from "unpdf";
import { createWorker } from "tesseract.js";
import engTrainedData from "@tesseract.js-data/eng";
import type { PdfDocument } from "./pdf-types";

type Item = { str: string; x: number; y: number; width: number; height: number };

// The "UID - <value>" line (and, on some reports, a filled-in Age value)
// on page 1 renders as flattened vector art from the PowerPoint export —
// confirmed absent from the real text layer on every page of the sample
// document, not an extraction bug. This crops just that line (bounds
// derived from the "Name:" and "Sample Details" text items' real
// positions, not hardcoded pixels) and OCRs only that small region —
// dramatically cheaper and more reliable than OCR-ing the whole document.
export async function extractUidAndAge(
  pdf: PdfDocument,
  page1Items: Item[]
): Promise<{ uid: string | null; age: number | null }> {
  const nameItem = page1Items.find((i) => /Name:/i.test(i.str));
  const sampleDetailsItem = page1Items.find((i) => /Sample Details/i.test(i.str));
  if (!nameItem || !sampleDetailsItem) {
    return { uid: null, age: null };
  }

  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const scale = 3;

  const pngBuffer = await renderPageAsImage(pdf, 1, {
    scale,
    canvasImport: () => import("@napi-rs/canvas"),
  });
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const img = await loadImage(Buffer.from(pngBuffer));

  const yTop = nameItem.y - nameItem.height * 0.5;
  const yBottom = sampleDetailsItem.y + sampleDetailsItem.height * 2;
  const pxTop = Math.max(0, Math.floor((viewport.height - yTop) * scale));
  const pxBottom = Math.ceil((viewport.height - yBottom) * scale);
  const cropHeight = Math.max(1, pxBottom - pxTop);

  const canvas = createCanvas(img.width, cropHeight);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, -pxTop);
  const cropBuffer = await canvas.encode("png");

  const worker = await createWorker("eng", 1, {
    langPath: engTrainedData.langPath,
    gzip: engTrainedData.gzip,
    cachePath: "/tmp",
  });
  try {
    const { data } = await worker.recognize(cropBuffer);
    const text = data.text;
    const uidMatch = text.match(/UID\s*-?\s*([A-Za-z0-9]+)/i);
    const ageMatch = text.match(/Age\s*:?\s*(\d+)/i);
    return { uid: uidMatch ? uidMatch[1] : null, age: ageMatch ? Number(ageMatch[1]) : null };
  } finally {
    await worker.terminate();
  }
}
