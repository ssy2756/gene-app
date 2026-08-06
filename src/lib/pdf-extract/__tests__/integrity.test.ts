import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { extractReportPdf } from "../index";
import { checkReportIntegrity, formatIntegrityIssues } from "../integrity";
import { splitBulletItems, stripTrailingHeading, isHeadingOnly } from "../sections";

// The point of this file is the first test: it asserts a *property* of the
// output ("nothing in here is garbled") rather than specific expected
// strings. The exact-output assertions in extract-report.test.ts only cover
// the handful of fields a human happened to look at in a screenshot; this
// one covers every string in the payload at once, so a corruption in a
// section nobody has inspected still fails the build.

describe("integrity checks", () => {
  describe("splitBulletItems", () => {
    it("joins a bullet wrapped across lines instead of splitting it into fragments", () => {
      const block = [
        "• Monitor liver enzymes, Complete Blood Count every 6 months to",
        "screen for fatty liver progression.",
        "• Maintain a healthy weight.",
      ].join("\n");
      expect(splitBulletItems(block)).toEqual([
        "Monitor liver enzymes, Complete Blood Count every 6 months to screen for fatty liver progression.",
        "Maintain a healthy weight.",
      ]);
    });

    it("still splits two items that share a physical line", () => {
      expect(splitBulletItems("• Avoid smoking. • Limit alcohol.")).toEqual(["Avoid smoking.", "Limit alcohol."]);
    });

    it("starts a new item after terminal punctuation even with no bullet glyph", () => {
      // The unlabeled-recommendation case: neither line carries a bullet, so
      // only sentence completion can tell them apart.
      const block = "Recommend a pre workout snack.\nAdequate hydration. Sleep of 6 to 8 hours.";
      expect(splitBulletItems(block)).toEqual([
        "Recommend a pre workout snack.",
        "Adequate hydration. Sleep of 6 to 8 hours.",
      ]);
    });
  });

  describe("heading bleed from the next page", () => {
    it("strips a banner heading appended onto the last bullet", () => {
      expect(stripTrailingHeading("Limit the intake of snacks. NOURISH & THRIVE : DIETARY INSIGHTS")).toBe(
        "Limit the intake of snacks.",
      );
    });

    it("leaves ordinary prose, and prose containing a short acronym, alone", () => {
      const item = "Monitor CBC and TSH yearly.";
      expect(stripTrailingHeading(item)).toBe(item);
      expect(isHeadingOnly(item)).toBe(false);
    });

    it("flags a standalone all-caps banner as heading-only", () => {
      expect(isHeadingOnly("YOUR FOOD SENSITIVITY")).toBe(true);
      expect(isHeadingOnly("MTHFR")).toBe(false);
    });
  });

  describe("checkReportIntegrity", () => {
    it("flags footer text, a leaked patient name, and a split sentence", () => {
      const issues = checkReportIntegrity({
        patient_information: { name: "Mr. Abbaya Chowdary Kothari" },
        condition_risk_overview: [{ condition: "X" }],
        medical_recommendations: [
          {
            recommendations: [
              "Monitor CBC yearly.",
              "palpitations or fatigue, follow up with a physician.",
              "Mr. Abbaya Chowdary Kothari",
              "This Report is Confidential and belongs to:",
            ],
          },
        ],
        vitamins_and_minerals: [{ name: "Iron" }],
        pharmacogenomics: { drug_recommendations: [{ drug: "warfarin" }] },
        fitness_and_nutrigenomics: { exercise: [{ recommendation: "Intensity - Moderate." }] },
      });
      const rules = issues.map((i) => i.rule);
      expect(rules).toContain("sentence-fragment");
      expect(rules).toContain("patient-name-leak");
      expect(rules).toContain("boilerplate-leak");
    });

    it("flags a section that came back empty", () => {
      const issues = checkReportIntegrity({ condition_risk_overview: [] });
      expect(issues.some((i) => i.rule === "empty-section" && i.path === "condition_risk_overview")).toBe(true);
    });
  });

  describe("the real report PDF", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let extracted: Record<string, any>;
    beforeAll(async () => {
      extracted = await extractReportPdf(readFileSync(path.join(__dirname, "../__fixtures__/sample-report.pdf")));
    }, 60_000);

    it("produces zero integrity issues across every string in the payload", () => {
      const issues = checkReportIntegrity(extracted);
      expect(issues.length, `\n${formatIntegrityIssues(issues)}\n`).toBe(0);
    });
  });
});
