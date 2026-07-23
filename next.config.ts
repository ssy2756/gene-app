import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These ship native/prebuilt binaries (canvas rendering, PDF parsing,
  // OCR WASM+worker files) that must not be webpack/turbopack-bundled —
  // they need to load from node_modules as-is at runtime.
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist", "tesseract.js"],
  // Belt-and-suspenders alongside the explicit import in pdf-ocr.ts: force
  // these dynamically-loaded runtime files (pdfjs's worker, tesseract's
  // WASM core/worker, the bundled trained-data file) into the deployed
  // function even if tracing would otherwise miss any of them.
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/tesseract.js-core/**",
      // The worker script's internal requires (constants/, utils/, etc.)
      // aren't all picked up by selectively including subfolders — the
      // first attempt (worker-script/** only) still 404'd on
      // constants/imageType. Include the whole package source tree.
      "./node_modules/tesseract.js/src/**",
      "./node_modules/@tesseract.js-data/eng/**",
      // tesseract.js's own runtime dependencies (its worker script
      // require()s these directly) — Next's tracer keeps missing pieces
      // of this tree one at a time (bmp-js, then the next one), so list
      // tesseract.js's full dependency set from its package.json instead
      // of continuing to whack-a-mole individual missing files.
      "./node_modules/bmp-js/**",
      "./node_modules/idb-keyval/**",
      "./node_modules/is-url/**",
      "./node_modules/node-fetch/**",
      "./node_modules/data-uri-to-buffer/**",
      "./node_modules/fetch-blob/**",
      "./node_modules/formdata-polyfill/**",
      "./node_modules/opencollective-postinstall/**",
      "./node_modules/regenerator-runtime/**",
      "./node_modules/wasm-feature-detect/**",
      "./node_modules/zlibjs/**",
    ],
  },
};

export default nextConfig;
