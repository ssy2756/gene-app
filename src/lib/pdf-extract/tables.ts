import type { PdfJsModule, PdfPage, PdfDocument } from "./pdf-types";
import {
  extractLineSegments,
  detectLineGrid,
  bucketItemsIntoGrid,
  extractCellFillRects,
  detectFillGrid,
  detectHybridGrid,
  bucketItemsIntoFillGrid,
} from "./grid";

type Item = { str: string; x: number; y: number; width: number; height: number };

async function fillGridRows(pdfjs: PdfJsModule, page: PdfPage, items: Item[]): Promise<string[][]> {
  const rects = await extractCellFillRects(pdfjs, page);
  const grid = detectFillGrid(rects);
  return bucketItemsIntoFillGrid(items, grid);
}

// ---- PGx diplotype panel: line-based grid (this table draws row-separator
// lines but no per-cell fill) ----
export async function parseDiplotypePanel(pdfjs: PdfJsModule, pdf: PdfDocument, pageNum: number, pageItems: Item[]) {
  const page = await pdf.getPage(pageNum);
  const segs = await extractLineSegments(pdfjs, page);
  const grid = detectLineGrid(segs);
  const rawRows = bucketItemsIntoGrid(pageItems, grid).filter((r) => r.some(Boolean));
  return rawRows
    .slice(1) // header row
    .map((r) => {
      const m = r[0]?.match(/^(\S+)\s+(\*.*)$/);
      return { gene: m ? m[1] : r[0], diplotype: m ? m[2] : "", phenotype: r[1] ?? "" };
    })
    .filter((d) => d.gene && d.gene !== "Gene");
}

// ---- PGx drug tables: fill-rect grid ----
const isHeaderRow = (r: string[]) => r[0] === "Molecule Class" && r[1] === "Drug(s)";
const isEmptyRow = (r: string[]) => r.every((c) => !c);

// A multi-page molecule-class section repeats its "Molecule Class" cell
// text on each new page it spans, but a wrapped 2-line label sometimes has
// its second line land in a different table row than our fill-grid
// bucketing expects, silently truncating the label on later pages (e.g.
// "Antiemetics (Nausea" instead of "Antiemetics (Nausea and Vomiting
// Drugs)") — and some sections' continuation-page label drops a trailing
// abbreviation entirely (e.g. "Anti-Epileptic Drugs" instead of
// "Anti-Epileptic Drugs (AEDs)"). This report's category list is a fixed
// template (same every time), so an explicit alias table — same pattern
// as GLOSSARY_NAME_ALIASES in sections.ts — is more robust here than a
// generic fuzzy-match heuristic.
const MOLECULE_CLASS_ALIASES: Record<string, string> = {
  "anti-epileptic drugs": "Anti-Epileptic Drugs (AEDs)",
  transplantation: "Transplantation Drugs",
  "antiemetics (nausea": "Antiemetics (Nausea and Vomiting Drugs)",
};

function normalizeMoleculeClass(label: string): string {
  const trimmed = label.trim();
  return MOLECULE_CLASS_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

export interface DrugRow {
  molecule_class: string;
  drug: string;
  evidence_level: string;
  phenotype: string;
  status: string;
  recommendation: string;
}

// The "Molecule Class" column is a single cell that visually spans every
// row in its group (confirmed directly from the PDF's own fill-rect
// geometry: a merged cell 259pt tall covering 9 drug rows, next to one
// 173pt tall covering 6, etc., vs. every other column's uniform 29pt
// per-row rects) — the label text itself is vertically centered inside
// that merged cell, so which individual 29pt-tall row(s) its glyphs land
// closest to varies (sometimes the group's first row, sometimes a middle
// row, sometimes split across two). A previous version of this parser
// picked "whichever row's own cell has non-empty column-0 text" as the
// label, which put multiple real categories' drugs under whichever
// label text happened to land on the group's first row (e.g. 15
// Calcium-Channel-Blocker/Beta-Blocker drugs all miscounted as
// "Potassium Sparing"). Grouping by the merged cell's actual y-range
// instead — not by which row its text happens to touch — is correct
// regardless of where in that range the label's glyphs render.
//
// A group that continues onto a new page doesn't redraw its colored fill
// cell there at all for the rows before the *next* category starts (only
// a genuinely new category gets a fresh merged cell on that page) — so
// carryLabel (the previous page's last-known class, threaded across pages
// by the caller) is used for any row with no covering label rect of its
// own, rather than leaving it blank.
export async function parseDrugTablePage(
  pdfjs: PdfJsModule,
  page: PdfPage,
  pageItems: Item[],
  carryLabel: string
): Promise<{ rows: DrugRow[]; lastLabel: string }> {
  const rects = await extractCellFillRects(pdfjs, page);
  const grid = detectFillGrid(rects);
  const rows = bucketItemsIntoFillGrid(pageItems, grid);
  if (grid.colBoundaries.length < 2 || grid.rowBoundaries.length < 2) return { rows: [], lastLabel: carryLabel };

  const labelColEnd = grid.colBoundaries[1];
  const labelRects = rects
    .filter((r) => r.x1 <= labelColEnd + 1)
    .map((r) => {
      const text = pageItems
        .filter((it) => it.str.trim() && it.x < labelColEnd + 1 && it.y <= r.y1 + 0.5 && it.y >= r.y0 - 0.5)
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .map((it) => it.str.trim())
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      return { y0: r.y0, y1: r.y1, label: text };
    })
    .filter((r) => r.label && r.label !== "Molecule Class");

  // Not every category gets a colored background cell — some render as
  // plain text at whatever row it happens to fall on, with no fill rect
  // at all (confirmed: the Opioids section on one page has zero label
  // rects, yet "Opioids" appears whole in one row's own bucketed text,
  // roughly mid-group rather than on the group's first row). A row with
  // neither signal is genuinely ambiguous on its own — it could be the
  // tail of the previous page's category, or the untitled lead-in of a
  // brand new one that hasn't announced itself yet. Resolving left-to-
  // right (carry the last-seen label forward) got this backwards for
  // Opioids: with no rect and no lead-in text, it kept extending the
  // *previous* page's trailing category across an entire new one instead.
  // Two passes fixes this correctly either way: first collect whatever
  // direct signal (rect or own-text) each row actually has, then fill
  // every gap from the *next* real signal *on this page* — which is
  // right whether that signal sits at the top of the group (the common
  // case) or, like Opioids, partway through it. Only a gap that runs to
  // the bottom of the page with no next signal at all falls back to the
  // previous page's carried label, since that really is a same-page
  // continuation with nothing left on this page to contradict it.
  const drugRowIdx: number[] = [];
  const rawLabel: (string | null)[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (isHeaderRow(r) || isEmptyRow(r) || !r[1]) continue;
    const yCenter = (grid.rowBoundaries[i] + grid.rowBoundaries[i + 1]) / 2;
    const owner = labelRects.find((lr) => yCenter <= lr.y1 + 0.5 && yCenter >= lr.y0 - 0.5);
    drugRowIdx.push(i);
    rawLabel.push(owner?.label || r[0] || null);
  }

  let next: string | null = null;
  for (let i = rawLabel.length - 1; i >= 0; i--) {
    if (rawLabel[i]) next = rawLabel[i];
    else rawLabel[i] = next;
  }

  const out: DrugRow[] = [];
  let lastLabel = carryLabel;
  for (let k = 0; k < drugRowIdx.length; k++) {
    const r = rows[drugRowIdx[k]];
    lastLabel = rawLabel[k] ?? lastLabel;
    out.push({
      molecule_class: normalizeMoleculeClass(lastLabel),
      drug: r[1],
      evidence_level: r[2] ?? "",
      phenotype: r[3] ?? "",
      status: r[4] ?? "",
      recommendation: r[4] ?? "",
    });
  }
  return { rows: out, lastLabel };
}

// ---- Methylation markers: fill-rect grid with 4 real columns fragmenting
// into ~8 raw sub-columns from decorative icon fills — merge by known
// sub-column groups (verified consistent across pages) ----
export async function parseMethylationPage(pdfjs: PdfJsModule, page: PdfPage, pageItems: Item[]) {
  const rows = await fillGridRows(pdfjs, page, pageItems);
  const join = (cells: string[]) => cells.filter(Boolean).join(" ").trim();
  const out: { gene_zygosity: string; clinical_significance: string; function: string; health_impact: string }[] = [];
  for (const r of rows) {
    const gene_zygosity = join(r.slice(0, 3));
    const clinical_significance = join(r.slice(3, 6));
    const isHeader = gene_zygosity === "Genes / Zygosity" || clinical_significance === "Clinical Significance";
    const isEmpty = !gene_zygosity && !clinical_significance && !r[6] && !r[7];
    if (isHeader || isEmpty) continue;
    // A "Recommendations" continuation page can repeat the same
    // "METHYLATION MARKERS" header text this table's page range is located
    // by, without containing real table rows — drop any row whose content
    // is actually recommendation prose, not a gene entry.
    if (/^Recommendations\s*:/i.test(gene_zygosity)) continue;
    out.push({ gene_zygosity, clinical_significance, function: r[6] ?? "", health_impact: r[7] ?? "" });
  }
  return out;
}

// Tables that color-fill only their header row and use plain divider lines
// (not fills) between body rows — see grid.ts's detectHybridGrid. When a
// table continues onto further pages without repeating its header (as the
// biomarkers glossary does), those pages have no fill rects to derive
// column boundaries from — pass the first page's boundaries through via
// `colBoundariesOverride` for those.
async function hybridGridRows(pdfjs: PdfJsModule, page: PdfPage, items: Item[], colBoundariesOverride?: number[]): Promise<{ rows: string[][]; colBoundaries: number[] }> {
  const [fillRects, lineSegs] = await Promise.all([extractCellFillRects(pdfjs, page), extractLineSegments(pdfjs, page)]);
  const grid = detectHybridGrid(fillRects, lineSegs);
  const colBoundaries = colBoundariesOverride ?? grid.colBoundaries;
  const rows = bucketItemsIntoFillGrid(items, { ...grid, colBoundaries });
  return { rows, colBoundaries };
}

// ---- References table (page with "References" heading, PMID | Citation) ----
export async function parseReferencesPage(pdfjs: PdfJsModule, page: PdfPage, pageItems: Item[]) {
  const { rows } = await hybridGridRows(pdfjs, page, pageItems);
  return rows
    .filter((r) => r[0] && r[0] !== "PMID")
    .map((r) => ({ pmid: r[0], citation: r[1] ?? "" }));
}

// ---- Biomarkers-analyzed glossary (Conditions | Biomarkers, spans
// multiple pages without repeating the header row) ----
export async function parseBiomarkersPages(pdfjs: PdfJsModule, pdf: PdfDocument, pageNums: number[], itemsByPage: Item[][]) {
  const out: { condition: string; biomarkers: string }[] = [];
  let sharedColBoundaries: number[] | undefined;
  for (const pageNum of pageNums) {
    const page = await pdf.getPage(pageNum);
    const { rows, colBoundaries } = await hybridGridRows(pdfjs, page, itemsByPage[pageNum - 1], sharedColBoundaries);
    if (!sharedColBoundaries && colBoundaries.length >= 2) sharedColBoundaries = colBoundaries;
    for (const r of rows) {
      if (!r[0] || r[0] === "Conditions") continue;
      out.push({ condition: r[0], biomarkers: r[1] ?? "" });
    }
  }
  return out;
}
