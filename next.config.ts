import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These ship native/prebuilt binaries (canvas rendering, PDF parsing,
  // OCR WASM+worker files) that must not be webpack/turbopack-bundled —
  // they need to load from node_modules as-is at runtime.
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist", "tesseract.js"],
};

export default nextConfig;
