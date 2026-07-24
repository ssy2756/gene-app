<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# PDF parsing is deterministic (no LLM) — see src/lib/pdf-extract

`src/lib/ingest-report.ts` calls `extractReportPdf()` in `src/lib/pdf-extract/index.ts`, which parses these GenepoweRx-style report PDFs with **no OCR of the whole document and no LLM call**. This replaced an earlier OCR(whole doc)+DeepSeek pipeline that repeatedly produced unstable output on the same document across many reparses: vitamins tier mis-assignment (3 separate recurrences), uid extraction drift, and — the bug that triggered this rewrite — a `food_sensitivity` gene list the model fabricated wholesale, since no gene data exists in that section of the source at all.

A diagnostic pass (`pdfinfo`/`pdffonts`, then direct `unpdf`/pdf.js text-item and operator-list inspection against the real sample PDF) established that this document type has a **real PDF text layer for essentially everything** — personal info, condition risk narratives, vitamins tiers, food-sensitivity descriptions, the 300+ row PGx drug tables, methylation markers, etc. The **only** field confirmed absent from the text layer on every page is the page-1 `"UID - <value>"` line (and, untested but likely, a filled-in `Age` value) — genuinely flattened vector art from the PowerPoint→PDF export, not an extraction bug. `src/lib/pdf-extract/ocr-fields.ts` handles exactly this one case: it crops just that line (bounds derived from real text-item positions, not hardcoded pixels) and runs `tesseract.js` on the small crop alone — dramatically cheaper and more reliable than OCR-ing 60-90 pages.

**If you're tempted to add OCR or an LLM call back into this pipeline for a "missing" field, don't — first check whether the field is actually in the text layer** using the same diagnostic technique (dump `unpdf`'s `extractTextItems()` raw item array for the page in question and search it directly, not the reconstructed-line text, which can mask a true miss). Only page-1 UID/Age has ever been confirmed as real flattened content in this document type.

Table extraction (`src/lib/pdf-extract/grid.ts`) does NOT use the `pdftables-ts` library — it performed badly on this document's real ruled tables (glyph-position clustering with no awareness of the PDF's actual vector-drawn lines/fills; the diplotype panel came back almost empty, drug tables had misaligned columns). Instead there are two custom detectors built directly on `unpdf`'s `getOperatorList()` access: one for stroked-line row separators (the diplotype panel), one for the per-cell colored fill rects this document renders for every drug-table/methylation-table row (verified consistent column boundaries across many pages). A third hybrid detector (`detectHybridGrid`) handles tables that color-fill only their header row and use plain divider lines for body rows (references, biomarkers glossary).

Section page-ranges are located by header-text search (`src/lib/pdf-extract/structure.ts`), never hardcoded page numbers — the PGx drug-table section in particular varies in length per patient depending on how many drug classes have findings.
