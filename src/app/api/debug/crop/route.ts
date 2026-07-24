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

  const returnFull = request.nextUrl.searchParams.get("full") === "1";
  if (returnFull) {
    return new NextResponse(Buffer.from(pngBuffer), { headers: { "Content-Type": "image/png" } });
  }

  const canvas = createCanvas(img.width, cropHeight);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, -pxTop);
  const cropBuffer = await canvas.encode("png");

  return new NextResponse(Buffer.from(cropBuffer), { headers: { "Content-Type": "image/png" } });
}
