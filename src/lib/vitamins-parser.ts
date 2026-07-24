// Deterministic parser for the "Vitamins and Minerals Summary" page's
// tier structure, bypassing the LLM for this one field.
//
// Why: across three separate reports, the model has repeatedly mis-assigned
// items to the wrong tier (Essential/Advised/Optional) — most often
// shifting everything up by one tier because of a stray single-character
// OCR-noise line right after a tier header. Prompt wording fixes have not
// held up across documents. But the raw OCR text for this section turns
// out to be highly regular:
//
//   Essential (Recommended Dosage Allowance/Day)
//   E
//   Advised (Recommended Dosage Allowance/Day)
//   VITAMIN B9 Folic Acid (400 pg)
//   Iron (11 mg)
//   VITAMIN-B12 (2.4 ug)
//   E
//   Optional (Recommended Dosage Allowance/Day)
//   VITAMIN-C (40 mg) Zinc (11 mg)
//   ...
//
// Tier headers are unambiguous literal keywords, and items are always
// "Name (dose)" — a plain state-machine scan of the text (no model
// judgment involved) gets this right every time, which is worth more
// here than any amount of additional prompt wording.

export type ParsedVitaminItem = { name: string; dose: string; tier: string };

const TIER_HEADER_RE = /^(Essential|Advised|Optional)\b/i;
const ITEM_RE = /([A-Za-z][A-Za-z0-9\-\s]{1,45}?)\s*\(([^)]{1,20})\)/g;

// Section boundaries: start at the first "VITAMINS AND MINERALS SUMMARY"
// heading, stop at the next major section (these reports move on to
// Pharmacogenomics/appendix/glossary content next).
const SECTION_START_RE = /VITAMINS AND MINERALS SUMMARY/i;
const SECTION_END_RE = /PHARMACOGENOMICS|GLOSSARY|THERAPEUTIC SUMMARY/i;

// Parses the vitamins/minerals tier structure directly out of the OCR'd
// document text. Returns null if the section can't be confidently found
// (caller should fall back to the LLM-provided vitamins_and_minerals in
// that case, rather than silently returning an empty/wrong result).
export function parseVitaminsSection(documentText: string): ParsedVitaminItem[] | null {
  const startMatch = SECTION_START_RE.exec(documentText);
  if (!startMatch) return null;

  const afterStart = documentText.slice(startMatch.index + startMatch[0].length);
  const endMatch = SECTION_END_RE.exec(afterStart);
  const sectionText = endMatch ? afterStart.slice(0, endMatch.index) : afterStart;

  const items: ParsedVitaminItem[] = [];
  let currentTier: string | null = null;
  let tiersSeen = 0;

  for (const rawLine of sectionText.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const headerMatch = TIER_HEADER_RE.exec(line);
    if (headerMatch) {
      currentTier = headerMatch[1][0].toUpperCase() + headerMatch[1].slice(1).toLowerCase();
      tiersSeen++;
      continue;
    }

    // Stray single/double-character OCR noise (misread decorative icons
    // near tier headers) — not a real item line, skip it.
    if (line.replace(/[^A-Za-z0-9]/g, "").length <= 2) continue;

    if (!currentTier) continue;

    let matched = false;
    for (const m of line.matchAll(ITEM_RE)) {
      const name = m[1].trim();
      const dose = m[2].trim();
      if (name.length < 2) continue;
      items.push({ name, dose, tier: currentTier });
      matched = true;
    }
    // Item printed with no dose in parentheses (rare, but don't silently
    // drop it) — keep the line as the name with an empty dose.
    if (!matched && /^[A-Za-z][A-Za-z0-9\-\s]{1,45}$/.test(line)) {
      items.push({ name: line, dose: "", tier: currentTier });
    }
  }

  // Sanity check: expect to have seen at least 2 of the 3 known tier
  // headers and at least one real item. If not, this document's layout
  // doesn't match what this parser expects — bail out and let the caller
  // fall back to the LLM's own answer instead of trusting a bad parse.
  if (tiersSeen < 2 || items.length === 0) return null;

  return items;
}
