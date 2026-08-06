// Content-integrity checks for extracted report data.
//
// reportDataSchema (report-schema.ts) validates *shape* — that the right
// fields exist with the right types. It cannot catch a field that is
// correctly-shaped but wrong: a recommendation with the page footer glued
// onto it, a sentence split in half by a PDF line wrap, the patient's name
// leaking out of patient_information and into a bullet list. Those are all
// non-empty strings, so Zod passes them and they render as garbage.
//
// Every bug reported against this parser so far has been of that kind, and
// each was found by a human looking at a screenshot days later. This module
// exists so the parser catches them itself, at ingest time, and names the
// exact section and text — instead of silently storing junk.
//
// These checks describe *failure signatures*, not per-report special cases:
// each one is a shape that is always wrong regardless of which report is
// being parsed, so a new report with different wording does not need a new
// check.

export type IntegrityIssue = {
  path: string;
  rule: string;
  detail: string;
  value: string;
};

// Page furniture that must never survive into extracted content. The
// misspelling "Pateint" is the source document's, not ours.
const BOILERPLATE = [
  /This Report is Confidential/i,
  /Pateint\s*Name/i,
  /^Page \d+( of \d+)?$/i,
];

// Fields whose items are prose sentences, so an item that starts
// mid-sentence or ends mid-sentence is a line-wrap that got split into two
// items (or a sentence that got truncated). Fields NOT listed here (vitamin
// names, gene symbols, drug names, risk levels) are legitimately not
// sentences and are exempt from those two rules.
const SENTENCE_LIST_FIELDS = new Set(["recommendations", "exercise"]);

// Sections that are present in every report of this type. An empty one means
// the section header moved or its wording changed and the locator silently
// matched nothing — the single most likely way a *new* report shape breaks
// this parser, and previously invisible until someone opened the app.
const REQUIRED_NONEMPTY: [string, (d: Report) => unknown][] = [
  ["condition_risk_overview", (d) => d.condition_risk_overview],
  ["medical_recommendations", (d) => d.medical_recommendations],
  ["vitamins_and_minerals", (d) => d.vitamins_and_minerals],
  ["pharmacogenomics.drug_recommendations", (d) => d.pharmacogenomics?.drug_recommendations],
  ["fitness_and_nutrigenomics.exercise", (d) => d.fitness_and_nutrigenomics?.exercise],
];

type Report = {
  patient_information?: { name?: unknown };
  condition_risk_overview?: unknown;
  medical_recommendations?: unknown;
  vitamins_and_minerals?: unknown;
  pharmacogenomics?: { drug_recommendations?: unknown };
  fitness_and_nutrigenomics?: { exercise?: unknown };
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Walks every string in the payload, tracking both the JSON path (for the
// error message) and the nearest enclosing array field name (to decide
// whether sentence rules apply).
function walkStrings(
  node: unknown,
  path: string,
  listField: string | null,
  visit: (value: string, path: string, listField: string | null) => void,
): void {
  if (typeof node === "string") {
    visit(node, path, listField);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => walkStrings(item, `${path}[${i}]`, listField, visit));
    return;
  }
  if (isRecord(node)) {
    for (const [key, value] of Object.entries(node)) {
      const nextList = Array.isArray(value) ? key : listField;
      walkStrings(value, path ? `${path}.${key}` : key, nextList, visit);
    }
  }
}

function looksLikePersonName(value: string): boolean {
  return /^(Mr|Mrs|Ms|Dr|Miss)\.?\s+[A-Z]/.test(value.trim());
}

export function checkReportIntegrity(data: unknown): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  if (!isRecord(data)) return issues;
  const report = data as Report;

  const add = (path: string, rule: string, detail: string, value: string) =>
    issues.push({ path, rule, detail, value: value.length > 160 ? `${value.slice(0, 160)}…` : value });

  // The patient's name is legitimate inside patient_information and nowhere
  // else. When it shows up in a bullet list it came from the page footer.
  const patientName =
    typeof report.patient_information?.name === "string" ? report.patient_information.name.trim() : "";

  walkStrings(data, "", null, (value, path, listField) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    for (const pattern of BOILERPLATE) {
      if (pattern.test(trimmed)) {
        add(path, "boilerplate-leak", "page footer/header text leaked into extracted content", trimmed);
        return;
      }
    }

    if (path.startsWith("patient_information")) return;

    if (patientName && patientName.length > 3 && trimmed.includes(patientName)) {
      add(path, "patient-name-leak", `patient name "${patientName}" appears outside patient_information`, trimmed);
      return;
    }

    // A standalone "Mr. Firstname Lastname" item in a list is the footer's
    // name field having been picked up as a recommendation — caught even
    // when it doesn't match patient_information (a mismatch between the two
    // is itself a sign the wrong value was read).
    if (listField && looksLikePersonName(trimmed) && trimmed.split(/\s+/).length <= 6) {
      add(path, "patient-name-leak", "list item is a bare person name, not content", trimmed);
      return;
    }

    if (!listField || !SENTENCE_LIST_FIELDS.has(listField)) return;

    // A prose item beginning lowercase is the tail of the previous item —
    // the line-wrap split bug.
    if (/^[a-z]/.test(trimmed)) {
      add(path, "sentence-fragment", "list item starts mid-sentence (previous item's line wrap was split off)", trimmed);
    }

    // …and one not ending in terminal punctuation lost its tail. Allow a
    // trailing colon, which introduces a genuinely list-shaped item.
    if (!/[.!?:]$/.test(trimmed)) {
      add(path, "sentence-truncated", "list item does not end in terminal punctuation (text was cut off)", trimmed);
    }
  });

  for (const [label, get] of REQUIRED_NONEMPTY) {
    const value = get(report);
    if (!Array.isArray(value) || value.length === 0) {
      add(label, "empty-section", "section is empty — its header probably moved or was reworded", "");
    }
  }

  return issues;
}

export function formatIntegrityIssues(issues: IntegrityIssue[]): string {
  return issues.map((i) => `${i.path} [${i.rule}] ${i.detail}${i.value ? `: "${i.value}"` : ""}`).join("\n");
}
