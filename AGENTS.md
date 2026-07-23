<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# PDF parsing must always OCR the full rendered page, across the ENTIRE document

The source reports (see `src/lib/ingest-report.ts`) render some fields — notably the `uid` — as graphics/vector art with no text-layer equivalent (e.g. the "UID - <value>" line on page 1, directly under Name/Age/Gender). A text-extraction-only pass over the PDF's text layer (pdf-parse, pdfplumber, etc.) misses these fields entirely.

Parsing runs on DeepSeek (`DEEPSEEK_API_KEY`, model configurable via `DEEPSEEK_MODEL`, default `deepseek-chat`) via the OpenAI SDK pointed at DeepSeek's OpenAI-compatible endpoint (`baseURL: https://api.deepseek.com`) — DeepSeek has no vision/file-input capability, so `src/lib/pdf-ocr.ts` rasterizes every page to a bitmap (`@napi-rs/canvas` + `pdfjs-dist`, both native/prebuilt-binary packages, not text-layer extraction) and OCRs each page (`tesseract.js`) before the OCR'd text is handed to the model as a plain-text prompt. Never swap this for a text-layer-only extraction pipeline — it would silently drop vector-art fields again.

These reports run 60-90+ pages, and each schema section (condition_risk_overview, medical_recommendations, pharmacogenomics, etc.) lives on its own pages well past page 1. The prompt must explicitly instruct the model to read the entire OCR'd document from first page to last and populate each section from wherever it actually appears — not just skim the first few pages. If extraction results ever look thin (e.g. missing sections that should be populated), suspect a truncated/incomplete OCR pass or under-scanning before suspecting the schema.
