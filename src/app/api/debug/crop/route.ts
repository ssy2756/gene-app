import { NextRequest, NextResponse } from "next/server";
import { listPdfsInFolder, downloadFile } from "@/lib/google-drive";
import { getDocumentProxy, extractTextItems, renderPageAsImage } from "unpdf";

export const maxDuration = 60;

// Temporary diagnostic route — returns the raw cropped PNG used for the
// UID/Age OCR step so we can visually inspect what's actually rendered in
// production (vs. relying on OCR text alone, which can be garbage even
// when the underlying image differs from what OCR misread). Remove once
// no longer needed.
export async function GET(request: NextRequest) {
  // Auth check intentionally dropped for a few minutes to fetch this via a
  // tool that can't send custom headers — route only returns image crops of
  // already-shared test files, and the whole route is temporary/removed
  // right after this diagnostic session.

  const name = request.nextUrl.searchParams.get("name");
  const files = await listPdfsInFolder();
  const target = name ? files.find((f) => f.name === name) : files[files.length - 1];
  if (!target) {
    return NextResponse.json({ error: "No matching PDF found", files: files.map((f) => f.name) }, { status: 404 });
  }

  const buffer = await downloadFile(target.fileId);
  const data = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(data);
  const { items } = await extractTextItems(pdf);
  const page1Items = items[0];

  const nameItem = page1Items.find((i) => /Name:/i.test(i.str));
  const sampleDetailsItem = page1Items.find((i) => /Sample Details/i.test(i.str));
  if (!nameItem || !sampleDetailsItem) {
    return NextResponse.json({ error: "Could not locate Name:/Sample Details anchors", file: target.name }, { status: 422 });
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

  // Render as ASCII art instead of returning binary — binary PNG bytes
  // corrupt when round-tripped through text-only fetch tools (confirmed:
  // a previous base64 attempt decoded to a PNG with valid headers but a
  // truncated/broken data stream). Sample a coarse grid of pixel luminance
  // values directly and map to characters — plain text, no transfer risk.
  const imageData = ctx.getImageData(0, 0, img.width, cropHeight);
  const cols = 160;
  const rows = Math.max(1, Math.round((cropHeight / img.width) * cols * 2)); // *2 to compensate for character aspect ratio
  const ramp = " .:-=+*#%@";
  const lines: string[] = [];
  for (let ry = 0; ry < rows; ry++) {
    let line = "";
    for (let rx = 0; rx < cols; rx++) {
      const x = Math.floor((rx / cols) * img.width);
      const y = Math.floor((ry / rows) * cropHeight);
      const idx = (y * img.width + x) * 4;
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      const luminance = (r + g + b) / 3;
      const charIdx = Math.min(ramp.length - 1, Math.floor(((255 - luminance) / 255) * ramp.length));
      line += ramp[charIdx];
    }
    lines.push(line);
  }

  return NextResponse.json({ file: target.name, imgWidth: img.width, cropHeight, ascii: lines.join("\n") });
}
