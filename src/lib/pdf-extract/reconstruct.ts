import type { StructuredTextItem } from "unpdf";

// pdf.js/unpdf's extractTextItems() gives positioned items, not joined
// lines. Cluster by y-position (PDF points) and sort each cluster by x to
// reconstruct reading-order lines — the same technique pdfplumber's
// extract_text() does internally.
export function reconstructLines(items: StructuredTextItem[], yTolerance = 2.5): string[] {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const clusters: StructuredTextItem[][] = [];

  for (const item of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(last[0].y - item.y) <= yTolerance) {
      last.push(item);
    } else {
      clusters.push([item]);
    }
  }

  return clusters.map((cluster) => cluster.sort((a, b) => a.x - b.x).map((i) => i.str).join(""));
}
