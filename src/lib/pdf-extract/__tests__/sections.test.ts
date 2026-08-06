import { describe, it, expect } from "vitest";
import { parseExercise, stripFooterLines } from "../sections";

// These fixtures are not invented — each is the exact per-page line array
// (in reading order, top to bottom) confirmed either by a direct
// text-item/y-coordinate dump of a real report PDF, or reconstructed from
// a user-supplied screenshot of a real report's rendered output. This file
// exists specifically because two earlier fixes each solved the case in
// front of them and silently broke a previously-working case — a fix here
// must keep every one of these passing, not just the newest one, or the
// same regression cycle repeats.

describe("Fitness page parsing — Exercise section + footer stripping", () => {
  it("report A: blank patient-name field, no separate name line (verified via a direct y-coordinate dump of __fixtures__/sample-report.pdf, page 21)", () => {
    const lines = [
      "Exercise:",
      "Frequency -4 days per week.",
      "Intensity -Moderate.",
      "• Time –30 minutes.",
      "Type -Flexibility and aerobic exercises like Yoga, mild weights, brisk",
      "walking, taking stairs, running. Include meditation and breathing exercises",
      "15 minutes/day.",
      "Precautions -Recommend adequate hydration. Sleep of 6 to 8 hours",
      "every night.",
      "This Report is Confidential and belongs to:",
      "Pateint Name",
    ];
    const result = parseExercise(stripFooterLines(lines));
    expect(result).toEqual([
      "Frequency -4 days per week.",
      "Intensity -Moderate.",
      "Time –30 minutes.",
      "Type -Flexibility and aerobic exercises like Yoga, mild weights, brisk walking, taking stairs, running. Include meditation and breathing exercises 15 minutes/day.",
      "Precautions -Recommend adequate hydration. Sleep of 6 to 8 hours every night.",
    ]);
  });

  it("report B: patient name filled in as its own trailing line below the label (reconstructed from a user screenshot — this exact shape leaked \"Mr. Abbaya Chowdary Kothari\" as its own spurious Exercise item in production)", () => {
    const lines = [
      "Exercise:",
      "Frequency - 4 days per week.",
      "Intensity - Moderate.",
      "Time – 30 minutes.",
      "Type - Mild strength and aerobic exercises like body weight resistance",
      "exercises, squats, brisk walking, taking stairs, running. Include meditation",
      "and breathing exercises 15 minutes/day.",
      "Precautions - Recommend pre workout snack 30 minutes before work out.",
      "Adequate hydration. Sleep of 6 to 8 hours every night.",
      "This Report is Confidential and belongs to:",
      "Pateint Name",
      "Mr. Abbaya Chowdary Kothari",
    ];
    const result = parseExercise(stripFooterLines(lines));
    expect(result).toEqual([
      "Frequency - 4 days per week.",
      "Intensity - Moderate.",
      "Time – 30 minutes.",
      "Type - Mild strength and aerobic exercises like body weight resistance exercises, squats, brisk walking, taking stairs, running. Include meditation and breathing exercises 15 minutes/day.",
      "Precautions - Recommend pre workout snack 30 minutes before work out.",
      "Adequate hydration. Sleep of 6 to 8 hours every night.",
    ]);
    // The two independent, unlabeled recommendations ("Precautions..." and
    // "Adequate hydration...") must stay separate — this is the specific
    // case a label-based split rule got wrong (it merged them because
    // neither line has a bullet or a recognized field label).
    expect(result).toHaveLength(6);
  });

  it("report C: name rendered on the SAME physical line as the 'Pateint Name' label (a plausible third layout — never actually observed, but stripFooterLines is documented to handle it, so lock that claim in)", () => {
    const lines = [
      "Exercise:",
      "Frequency - 4 days per week.",
      "Precautions - Recommend pre workout snack 30 minutes before work out.",
      "This Report is Confidential and belongs to:",
      "Pateint Name Mr. Abbaya Chowdary Kothari",
    ];
    const result = parseExercise(stripFooterLines(lines));
    expect(result).toEqual([
      "Frequency - 4 days per week.",
      "Precautions - Recommend pre workout snack 30 minutes before work out.",
    ]);
  });

  it("report D: name printed directly under the confidential line with the 'Pateint Name' label omitted entirely (the real report behind the 14-issue integrity failure — every earlier version of stripFooterLines left this footer completely intact, because it scanned backward, found a name rather than a label on the last line, and stopped)", () => {
    const lines = [
      "Exercise:",
      "Frequency - 4 days per week.",
      "Precautions - Recommend adequate hydration.",
      "This Report is Confidential and belongs to:",
      "Mr. Abbaya Chowdary Kothari",
    ];
    const result = parseExercise(stripFooterLines(lines));
    expect(result).toEqual([
      "Frequency - 4 days per week.",
      "Precautions - Recommend adequate hydration.",
    ]);
  });

  it("never lets a name-shaped line leak into the middle of the list when it's genuinely part of a recommendation's own wording", () => {
    // Guard against stripFooterLines being made too aggressive in a future
    // fix — a capitalized multi-word phrase mid-document (not at the very
    // bottom of the page, not adjacent to the "Pateint Name" label) must
    // never be treated as footer junk.
    const lines = [
      "Exercise:",
      "Frequency - 4 days per week.",
      "Precautions - Recommend consulting Doctor Smith Jones before starting.",
    ];
    const result = parseExercise(stripFooterLines(lines));
    expect(result).toEqual([
      "Frequency - 4 days per week.",
      "Precautions - Recommend consulting Doctor Smith Jones before starting.",
    ]);
  });
});
