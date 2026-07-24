import { renderPageAsImage } from "unpdf";
import { createWorker } from "tesseract.js";
import engTrainedData from "@tesseract.js-data/eng";
import path from "node:path";
import type { PdfDocument } from "./pdf-types";

type Item = { str: string; x: number; y: number; width: number; height: number };

// Vercel's serverless container has no system fonts installed at all, so
// @napi-rs/canvas can't substitute ANY glyph for the PDF's embedded subset
// fonts (confirmed via "Cannot substitute the font because of its name"
// warnings) — this blanked not just the vector-art UID line but the
// adjacent real text ("Name:"/"Gender:") too, in the actual deployed
// environment (it worked locally only because the local sandbox happens to
// have usable system fonts). Register a bundled OFL-licensed font as an
// explicit fallback so rendering doesn't depend on what fonts (if any)
// happen to be installed in the runtime environment.
let fontsRegistered = false;
async function ensureFontsRegistered() {
  if (fontsRegistered) return;
  const { GlobalFonts } = await import("@napi-rs/canvas");
  const fontsDir = path.join(process.cwd(), "assets", "fonts");
  for (const alias of ["Arial", "ArialMT", "Helvetica", "sans-serif", "Arial-BoldMT", "Helvetica-Bold"]) {
    const isBold = alias.toLowerCase().includes("bold");
    GlobalFonts.registerFromPath(path.join(fontsDir, isBold ? "WorkSans-Bold.ttf" : "WorkSans-Regular.ttf"), alias);
  }
  fontsRegistered = true;
}

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

  await ensureFontsRegistered();

  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const scale = 3;

  const pngBuffer = await renderPageAsImage(pdf, 1, {
    scale,
    canvasImport: () => import("@napi-rs/canvas"),
  });
  console.log(`[ocr-fields] rendered page PNG: ${pngBuffer.byteLength} bytes`);
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const img = await loadImage(Buffer.from(pngBuffer));
  console.log(`[ocr-fields] loaded image: ${img.width}x${img.height}`);

  const yTop = nameItem.y - nameItem.height * 0.5;
  const yBottom = sampleDetailsItem.y + sampleDetailsItem.height * 2;
  const pxTop = Math.max(0, Math.floor((viewport.height - yTop) * scale));
  const pxBottom = Math.ceil((viewport.height - yBottom) * scale);
  const cropHeight = Math.max(1, pxBottom - pxTop);
  console.log(`[ocr-fields] crop: pxTop=${pxTop} pxBottom=${pxBottom} cropHeight=${cropHeight} imgWidth=${img.width}`);

  const canvas = createCanvas(img.width, cropHeight);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, -pxTop);
  const cropBuffer = await canvas.encode("png");
  console.log(`[ocr-fields] crop PNG: ${cropBuffer.byteLength} bytes`);

  const worker = await createWorker("eng", 1, {
    langPath: engTrainedData.langPath,
    gzip: engTrainedData.gzip,
    cachePath: "/tmp",
  });
  try {
    const { data } = await worker.recognize(cropBuffer);
    const text = data.text;
    console.log(`[ocr-fields] OCR raw text: ${JSON.stringify(text)}`);
    const uidMatch = text.match(/UID\s*-?\s*([A-Za-z0-9]+)/i);
    const ageMatch = text.match(/Age\s*:?\s*(\d+)/i);
    return { uid: uidMatch ? uidMatch[1] : null, age: ageMatch ? Number(ageMatch[1]) : null };
  } finally {
    await worker.terminate();
  }
}
