import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The full-pipeline test in extract-report.test.ts runs OCR + real PDF
    // parsing against a 66-page document — give it real headroom instead
    // of vitest's 5s default.
    testTimeout: 60_000,
  },
});
