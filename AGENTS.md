<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# PDF parsing must always use vision

The source reports (see `src/app/api/parse-pdf/route.ts`) render some fields — notably the `uid` — as graphics/vector art with no text-layer equivalent (e.g. the "UID - <value>" line on page 1, directly under Name/Age/Gender). A text-extraction-only pass over the PDF misses these fields entirely.

Always send the PDF to Claude as a `document` content block (vision-based page reading), never swap it for a text-only extraction pipeline (pdf-parse, pdfplumber, etc. piped into a plain-text prompt). The prompt must explicitly instruct the model to visually inspect every page rather than trust any embedded text layer.
