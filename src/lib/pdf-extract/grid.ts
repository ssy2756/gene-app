// Table structure detection from the PDF's own vector graphics — the same
// signal pdfplumber uses under the hood. A prior attempt with the
// `pdftables-ts` library (pure glyph-position clustering, no awareness of
// the PDF's actual drawn lines/fills) performed badly on this document's
// real ruled tables (diplotype panel came back almost empty, drug tables
// had misaligned columns, comma-list tables fragmented badly) — these two
// detectors, built directly on unpdf's operator-list access, replace it.
import type { PdfJsModule, PdfPage } from "./pdf-types";

export interface LineSeg {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// Detector 1: thin stroked-line row separators (used for tables that draw
// row-divider lines but don't fill each cell with a background color, e.g.
// the PGx diplotype panel).
export async function extractLineSegments(pdfjs: PdfJsModule, page: PdfPage): Promise<LineSeg[]> {
  const opList = await page.getOperatorList();
  const { OPS } = pdfjs;
  const segs: LineSeg[] = [];
  for (let i = 0; i < opList.fnArray.length; i++) {
    if (opList.fnArray[i] !== OPS.constructPath) continue;
    const bbox = opList.argsArray[i][2];
    if (!bbox) continue;
    const [x0, y0, x1, y1] = bbox;
    segs.push({ x0, y0, x1, y1 });
  }
  return segs;
}

function clusterValues(values: number[], tolerance: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const v of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && v - last[last.length - 1] <= tolerance) {
      last.push(v);
    } else {
      clusters.push([v]);
    }
  }
  return clusters.map((c) => c.reduce((a, b) => a + b, 0) / c.length);
}

export interface TableGrid {
  rowBoundaries: number[];
  colBoundaries: number[];
}

export function detectLineGrid(segs: LineSeg[]): TableGrid {
  const horiz = segs.filter((s) => {
    const h = Math.abs(s.y1 - s.y0);
    const w = Math.abs(s.x1 - s.x0);
    return h <= 1.5 && w >= 20;
  });
  const rowBoundaries = clusterValues(horiz.map((s) => (s.y0 + s.y1) / 2), 2).sort((a, b) => b - a);
  const xBreaks = new Set<number>();
  for (const s of horiz) {
    xBreaks.add(s.x0);
    xBreaks.add(s.x1);
  }
  const colBoundaries = clusterValues([...xBreaks], 3).sort((a, b) => a - b);
  return { rowBoundaries, colBoundaries };
}

export function bucketItemsIntoGrid<T extends { x: number; y: number; str: string }>(items: T[], grid: TableGrid): string[][] {
  const { rowBoundaries, colBoundaries } = grid;
  if (rowBoundaries.length < 2 || colBoundaries.length < 2) return [];

  const rows: string[][] = Array.from({ length: rowBoundaries.length - 1 }, () =>
    Array.from({ length: colBoundaries.length - 1 }, () => "")
  );

  for (const item of items) {
    if (!item.str.trim()) continue;
    let rowIdx = -1;
    for (let r = 0; r < rowBoundaries.length - 1; r++) {
      if (item.y <= rowBoundaries[r] && item.y >= rowBoundaries[r + 1]) {
        rowIdx = r;
        break;
      }
    }
    let colIdx = -1;
    for (let c = 0; c < colBoundaries.length - 1; c++) {
      if (item.x >= colBoundaries[c] && item.x < colBoundaries[c + 1]) {
        colIdx = c;
        break;
      }
    }
    if (rowIdx >= 0 && colIdx >= 0) {
      rows[rowIdx][colIdx] = (rows[rowIdx][colIdx] ? rows[rowIdx][colIdx] + " " : "") + item.str;
    }
  }

  return rows.map((r) => r.map((c) => c.trim()));
}

// Detector 2: per-cell colored fill rects (used for tables that render a
// background fill behind every cell, e.g. the PGx drug tables and
// methylation markers table) — gives precise row AND column boundaries
// directly, verified consistent across many pages and non-straddling with
// real text items.
export interface FillRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export async function extractCellFillRects(pdfjs: PdfJsModule, page: PdfPage): Promise<FillRect[]> {
  const opList = await page.getOperatorList();
  const { OPS } = pdfjs;
  const rects: FillRect[] = [];
  for (let i = 0; i < opList.fnArray.length; i++) {
    if (opList.fnArray[i] !== OPS.constructPath) continue;
    const bbox = opList.argsArray[i][2];
    if (!bbox) continue;
    const [x0, y0, x1, y1] = bbox;
    const w = x1 - x0;
    const h = y1 - y0;
    // Row heights vary a lot by table (short fixed-height drug-table rows
    // vs. tall wrapped-text methylation rows) — exclude only full-page
    // background blocks and thin decorative divider bars, not a fixed
    // row-height range.
    if (w > 40 && h > 8 && h < 400) {
      rects.push({ x0, y0, x1, y1 });
    }
  }
  return rects;
}

export interface FillGrid {
  colBoundaries: number[];
  rowBoundaries: number[];
}

export function detectFillGrid(rects: FillRect[]): FillGrid {
  const xBreaks = new Set<number>();
  const yBreaks = new Set<number>();
  for (const r of rects) {
    xBreaks.add(Math.round(r.x0 * 10) / 10);
    xBreaks.add(Math.round(r.x1 * 10) / 10);
    yBreaks.add(Math.round(r.y0 * 10) / 10);
    yBreaks.add(Math.round(r.y1 * 10) / 10);
  }
  const colBoundaries = clusterValues([...xBreaks], 2);
  const rowBoundaries = clusterValues([...yBreaks], 2).sort((a, b) => b - a);
  return { colBoundaries, rowBoundaries };
}

// Detector 3: hybrid grid for tables that color-fill only the header row
// but use plain thin divider lines (not fills) between body rows — column
// boundaries come from the header's fill rects, row boundaries from line
// segments (same signal as detectLineGrid). Used for the references and
// biomarkers-glossary tables.
export function detectHybridGrid(fillRects: FillRect[], lineSegs: LineSeg[]): FillGrid {
  // Header fills are reasonably wide and short (row-label height, not a
  // full-page background); take their x-edges as column boundaries.
  const headerFills = fillRects.filter((r) => {
    const h = r.y1 - r.y0;
    return h > 10 && h < 60;
  });
  const xBreaks = new Set<number>();
  for (const r of headerFills) {
    xBreaks.add(Math.round(r.x0 * 10) / 10);
    xBreaks.add(Math.round(r.x1 * 10) / 10);
  }
  const colBoundaries = clusterValues([...xBreaks], 2);

  const horiz = lineSegs.filter((s) => {
    const h = Math.abs(s.y1 - s.y0);
    const w = Math.abs(s.x1 - s.x0);
    return h <= 1.5 && w >= 20;
  });
  const yBreaks = new Set<number>();
  for (const s of horiz) {
    yBreaks.add(Math.round(((s.y0 + s.y1) / 2) * 10) / 10);
  }
  // Include the header fill rects' own top/bottom edges as the first two
  // row boundaries, since the header row itself has no divider line above it.
  for (const r of headerFills) {
    yBreaks.add(Math.round(r.y0 * 10) / 10);
    yBreaks.add(Math.round(r.y1 * 10) / 10);
  }
  const rowBoundaries = clusterValues([...yBreaks], 2).sort((a, b) => b - a);

  return { colBoundaries, rowBoundaries };
}

export function bucketItemsIntoFillGrid<T extends { x: number; y: number; str: string }>(items: T[], grid: FillGrid): string[][] {
  const { rowBoundaries, colBoundaries } = grid;
  if (rowBoundaries.length < 2 || colBoundaries.length < 2) return [];

  const rows: string[][] = Array.from({ length: rowBoundaries.length - 1 }, () =>
    Array.from({ length: colBoundaries.length - 1 }, () => "")
  );

  for (const item of items) {
    if (!item.str.trim()) continue;
    let rowIdx = -1;
    for (let r = 0; r < rowBoundaries.length - 1; r++) {
      if (item.y <= rowBoundaries[r] + 0.5 && item.y >= rowBoundaries[r + 1] - 0.5) {
        rowIdx = r;
        break;
      }
    }
    if (rowIdx < 0) continue;

    let colIdx = -1;
    for (let c = 0; c < colBoundaries.length - 1; c++) {
      if (item.x >= colBoundaries[c] - 0.5 && item.x < colBoundaries[c + 1] + 0.5) {
        colIdx = c;
        break;
      }
    }
    if (colIdx < 0) continue;

    rows[rowIdx][colIdx] = (rows[rowIdx][colIdx] ? rows[rowIdx][colIdx] + " " : "") + item.str;
  }

  return rows.map((r) => r.map((c) => c.trim()));
}
