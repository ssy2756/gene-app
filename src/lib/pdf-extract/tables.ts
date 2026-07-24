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

// ---- PGx drug tables: fill-rect grid, group-based merged-cell handling ----
const isHeaderRow = (r: string[]) => r[0] === "Molecule Class" && r[1] === "Drug(s)";
const isEmptyRow = (r: string[]) => r.every((c) => !c);
const isSpacerRow = (r: string[]) => !isHeaderRow(r) && r.slice(1).every((c) => !c);

export interface DrugRow {
  molecule_class: string;
  drug: string;
  evidence_level: string;
  phenotype: string;
  status: string;
  recommendation: string;
}

export async function parseDrugTablePage(pdfjs: PdfJsModule, page: PdfPage, pageItems: Item[]): Promise<DrugRow[]> {
  const rows = await fillGridRows(pdfjs, page, pageItems);
  const cleaned = rows.filter((r) => !isEmptyRow(r) && !isSpacerRow(r));

  const groups: string[][][] = [];
  let current: string[][] = [];
  for (const row of cleaned) {
    if (isHeaderRow(row)) {
      if (current.length) groups.push(current);
      current = [];
      groups.push([row]);
    } else {
      current.push(row);
    }
  }
  if (current.length) groups.push(current);

  const out: DrugRow[] = [];
  for (const group of groups) {
    if (group.length === 1 && isHeaderRow(group[0])) continue;
    const label = group.find((r) => r[0])?.[0] ?? "";
    for (const r of group) {
      if (!r[1]) continue;
      out.push({
        molecule_class: label,
        drug: r[1],
        evidence_level: r[2] ?? "",
        phenotype: r[3] ?? "",
        status: r[4] ?? "",
        recommendation: r[4] ?? "",
      });
    }
  }
  return out;
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
