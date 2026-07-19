<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# PDF parsing must always use vision, across the ENTIRE document

The source reports (see `src/app/api/parse-pdf/route.ts`) render some fields — notably the `uid` — as graphics/vector art with no text-layer equivalent (e.g. the "UID - <value>" line on page 1, directly under Name/Age/Gender). A text-extraction-only pass over the PDF misses these fields entirely.

Always send the PDF to Claude as a `document` content block (vision-based page reading), never swap it for a text-only extraction pipeline (pdf-parse, pdfplumber, etc. piped into a plain-text prompt).

These reports run 60-90+ pages, and each schema section (condition_risk_overview, medical_recommendations, pharmacogenomics, diet_plan, appendix, etc.) lives on its own pages well past page 1. The prompt must explicitly instruct the model to visually scan every page from first to last and populate each section from wherever it actually appears in the document — not just skim the first few pages. If extraction results ever look thin (e.g. missing sections that should be populated), suspect under-scanning before suspecting the schema.
