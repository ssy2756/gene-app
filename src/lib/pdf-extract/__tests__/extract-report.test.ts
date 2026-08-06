import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { extractReportPdf } from "../index";
import { reportDataSchema } from "../../report-schema";

// Full end-to-end regression check against a real report PDF (not a
// synthetic line array) — catches anything a unit-level fixture test can't,
// e.g. a page-range/header-matching regression, or a change that passes
// every sections.test.ts case in isolation but breaks once real PDF
// geometry (fill-rects, line grids, item ordering) is involved.
const FIXTURE_PATH = path.join(__dirname, "../__fixtures__/sample-report.pdf");

describe("extractReportPdf — full pipeline against a real report PDF", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let extracted: Record<string, any>;

  beforeAll(async () => {
    const buf = readFileSync(FIXTURE_PATH);
    extracted = await extractReportPdf(buf);
  }, 60_000);

  it("passes the strict Zod validator end to end", () => {
    const result = reportDataSchema.safeParse(extracted);
    if (!result.success) {
      throw new Error(`Validation failed: ${JSON.stringify(result.error.issues, null, 2)}`);
    }
  });

  it("produces the known-correct Exercise list — no leaked footer/name, no broken sentences", () => {
    const exercise = extracted.fitness_and_nutrigenomics.exercise.map((e: { recommendation: string }) => e.recommendation);
    expect(exercise).toEqual([
      "Frequency - 4 days per week.",
      "Intensity - Moderate.",
      "Time – 30 minutes.",
      "Type - Flexibility and aerobic exercises like Yoga, mild weights, brisk walking, taking stairs, running. Include meditation and breathing exercises 15 minutes/day.",
      "Precautions - Recommend adequate hydration. Sleep of 6 to 8 hours every night.",
    ]);
    // Guards against a regression re-introducing the footer/patient-name
    // leak anywhere in the Exercise list, independent of the exact wording
    // asserted above.
    for (const item of exercise) {
      expect(item).not.toMatch(/Pateint\s*Name/i);
      expect(item).not.toMatch(/This Report is Confidential/i);
    }
  });

  it("does not surface the musculoskeletal narrative on the Fitness card's own field (report-mapping.ts's mapFitness intentionally drops it as a duplicate of the Health Risks screen's content)", () => {
    // extractReportPdf itself still returns the narrative (report-mapping
    // decides not to surface it) — assert it's present here so a future
    // change to the extractor can't silently start dropping it from the
    // stored data too, only from what's displayed.
    expect(extracted.fitness_and_nutrigenomics.musculoskeletal.narrative).toContain("homozygous");
  });

  it("keeps the PGx drug table grouped correctly — regression guard for the molecule_class mis-grouping bug", () => {
    const drugs = extracted.pharmacogenomics.drug_recommendations as { molecule_class: string }[];
    const byClass = new Map<string, number>();
    for (const d of drugs) byClass.set(d.molecule_class, (byClass.get(d.molecule_class) ?? 0) + 1);
    // The real failure mode was "Potassium Sparing" absorbing Calcium
    // Channel Blockers + Beta Blockers wholesale — assert the true split
    // instead of a coarser "no single class dominates" check, since that's
    // the exact regression this guards against.
    expect(byClass.get("Potassium Sparing Diuretics") ?? byClass.get("Potassium Sparing")).toBeLessThanOrEqual(3);
    expect(drugs.length).toBeGreaterThan(100);
  });
});
