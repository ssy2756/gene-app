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
      "./node_modules/tesseract.js/src/worker-script/**",
      "./node_modules/@tesseract.js-data/eng/**",
    ],
  },
};

export default nextConfig;
