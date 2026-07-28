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

// The "CONDITIONS / RISK / GLOSSARY OF MEDICAL CONDITIONS" pages print a
// colored risk badge for every condition (including ones that never get a
// "You have X genetic risk for Y" narrative elsewhere in the report), but
// that badge is vector art with zero underlying text — confirmed via a
// direct text-item dump (the RISK column, x roughly 110-226, has no text
// items at all; only the bottom legend row "Low Mild Moderate Moderate to
// high" is real text). Each row's "Genes - (N)" line IS real text and the
// gene count is unique per condition, so rows are keyed by that count
// rather than by trying to OCR or re-parse the condition name.
const GLOSSARY_GENES_RE = /^Genes\s*[-–]\s*\((\d+)\)$/;

export async function extractGlossaryRiskLevels(
  pdf: PdfDocument,
  pageNum: number,
  pageItems: Item[]
): Promise<Map<number, string | null>> {
  const results = new Map<number, string | null>();
  const rows = pageItems
    .map((i) => ({ item: i, match: i.str.trim().match(GLOSSARY_GENES_RE) }))
    .filter((r): r is { item: Item; match: RegExpMatchArray } => r.match !== null)
    .map((r) => ({ genes: Number(r.match[1]), y: r.item.y }))
    .sort((a, b) => b.y - a.y);
  if (rows.length === 0) return results;

  await ensureFontsRegistered();

  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const scale = 3;

  const pngBuffer = await renderPageAsImage(pdf, pageNum, { scale, canvasImport: () => import("@napi-rs/canvas") });
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const img = await loadImage(Buffer.from(pngBuffer));

  const xLeft = 108;
  const xRight = 227;
  const pxLeft = Math.max(0, Math.floor(xLeft * scale));
  const pxRight = Math.min(img.width, Math.ceil(xRight * scale));
  const cropWidth = pxRight - pxLeft;

  const worker = await createWorker("eng", 1, {
    langPath: engTrainedData.langPath,
    gzip: engTrainedData.gzip,
    cachePath: "/tmp",
  });
  try {
    for (let i = 0; i < rows.length; i++) {
      const top = i === 0 ? rows[i].y + 40 : (rows[i - 1].y + rows[i].y) / 2;
      const bottom = i + 1 < rows.length ? (rows[i].y + rows[i + 1].y) / 2 : rows[i].y - 40;
      const pxTop = Math.max(0, Math.floor((viewport.height - top) * scale));
      const pxBottom = Math.min(img.height, Math.ceil((viewport.height - bottom) * scale));
      const cropHeight = pxBottom - pxTop;
      if (cropHeight <= 0 || cropWidth <= 0) continue;

      const canvas = createCanvas(cropWidth, cropHeight);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, -pxLeft, -pxTop);
      const cropBuffer = await canvas.encode("png");
      const { data } = await worker.recognize(cropBuffer);
      const match = data.text.match(/\b(low|mild|moderate to high|moderate|high)\b/i);
      results.set(rows[i].genes, match ? match[1].toLowerCase() : null);
    }
  } finally {
    await worker.terminate();
  }
  return results;
}

// Some pages print a risk-level word ("Mild"/"Low"/"Moderate"/"High") only
// as a label next to a thermometer-gauge graphic, not as extractable text —
// confirmed via a direct text-item dump (zero items anywhere in the right
// ~40% of the page for the food-sensitivity page) — same category of
// problem as the page-1 UID line. This crops a vertical band per category
// (title item's y down to the next category's y, i.e. that category's full
// row) on the right-hand side of the page, where these reports place the
// gauge, and OCRs just that strip.
export async function extractGaugeRiskLevels(
  pdf: PdfDocument,
  pageNum: number,
  pageItems: Item[],
  categoryTitleRe: RegExp
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  const categoryItems = pageItems.filter((i) => categoryTitleRe.test(i.str.trim())).sort((a, b) => b.y - a.y);
  if (categoryItems.length === 0) return results;

  await ensureFontsRegistered();

  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const scale = 3;

  const pngBuffer = await renderPageAsImage(pdf, pageNum, { scale, canvasImport: () => import("@napi-rs/canvas") });
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const img = await loadImage(Buffer.from(pngBuffer));

  const worker = await createWorker("eng", 1, {
    langPath: engTrainedData.langPath,
    gzip: engTrainedData.gzip,
    cachePath: "/tmp",
  });
  try {
    for (let i = 0; i < categoryItems.length; i++) {
      const name = categoryItems[i].str.trim();
      const top = categoryItems[i].y + 20;
      const bottom = i + 1 < categoryItems.length ? categoryItems[i + 1].y : 0;
      const pxTop = Math.max(0, Math.floor((viewport.height - top) * scale));
      const pxBottom = Math.min(img.height, Math.ceil((viewport.height - bottom) * scale));
      const cropHeight = pxBottom - pxTop;
      if (cropHeight <= 0) continue;
      const xStart = Math.floor(viewport.width * 0.72 * scale);
      const cropWidth = img.width - xStart;

      const canvas = createCanvas(cropWidth, cropHeight);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, -xStart, -pxTop);
      const cropBuffer = await canvas.encode("png");
      const { data } = await worker.recognize(cropBuffer);
      const match = data.text.match(/\b(low|mild|moderate|high)\b/i);
      results.set(name, match ? match[1].toLowerCase() : null);
    }
  } finally {
    await worker.terminate();
  }
  return results;
}

// A small number of "You have X genetic risk for Y..." cards on the medical
// concerns pages have zero extractable text items at all — not vector art
// (they render as normal-looking text visually), but a broken/missing
// ToUnicode mapping for that specific text run, confirmed by a direct
// text-item dump (0 items for that card, vs dozens for a normal card on the
// same page). OCR-ing the whole page is the only way to recover them, since
// there's no real text position to anchor a small crop to.
export async function extractFullPageText(pdf: PdfDocument, pageNum: number): Promise<string> {
  await ensureFontsRegistered();
  const pngBuffer = await renderPageAsImage(pdf, pageNum, { scale: 3, canvasImport: () => import("@napi-rs/canvas") });
  const worker = await createWorker("eng", 1, {
    langPath: engTrainedData.langPath,
    gzip: engTrainedData.gzip,
    cachePath: "/tmp",
  });
  try {
    const { data } = await worker.recognize(Buffer.from(pngBuffer));
    return data.text;
  } finally {
    await worker.terminate();
  }
}
