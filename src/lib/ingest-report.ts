import OpenAI from "openai";
import { sql } from "@/lib/db";
import { REPORT_JSON_SCHEMA, reportDataSchema } from "@/lib/report-schema";

// Lazily constructed on first use, not at module load: the OpenAI SDK throws
// immediately if no API key is available, and Next.js evaluates route
// modules during its build-time "collect page data" step even for dynamic
// routes — throwing at import time would fail the build itself whenever
// OPENAI_API_KEY isn't set yet (e.g. before it's added in Vercel).
let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

// Vision-capable, PDF-file-input-capable model. Override via env if a newer
// model should be used without a code change.
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

export class IngestError extends Error {
  status: number;
  issues?: unknown;

  constructor(message: string, status: number, issues?: unknown) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

// Parses a genomic report PDF via OpenAI, validates the result, and upserts
// it into `reports` keyed by uid. Shared by the manual upload route
// (src/app/api/parse-pdf/route.ts) and the Google Drive ingestion pipeline
// (src/app/api/drive/webhook, scripts/poll-drive.ts) so there is exactly one
// place that defines how a PDF becomes a stored report.
export async function ingestReportPdf(pdfBuffer: Buffer): Promise<{ uid: string }> {
  const pdfBase64 = pdfBuffer.toString("base64");

  // IMPORTANT: these reports render some fields (e.g. the UID) as graphics/vector
  // art with no corresponding text-layer content — a text-extraction pass over
  // the PDF misses them entirely. Passing the PDF as an `input_file` makes the
  // model read it via vision (each page rendered as an image internally), not
  // just its text layer; the prompt below reinforces that explicitly. Do not
  // swap this for a text-only extraction path (e.g. pdf-parse/pdfplumber piped
  // into a plain text prompt).
  const response = await getOpenAI().responses.create({
    model: MODEL,
    // gpt-4o's output cap is 16384 tokens; raise this if OPENAI_MODEL is
    // swapped for a model with a larger output limit.
    max_output_tokens: 16000,
    // Forces valid JSON output. Without this, smaller models (e.g.
    // gpt-4o-mini) sometimes wrap the JSON in markdown code fences or add
    // stray prose despite the prompt saying not to — this makes it a hard
    // API-level guarantee instead of a request.
    text: { format: { type: "json_object" } },
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename: "report.pdf",
            file_data: `data:application/pdf;base64,${pdfBase64}`,
          },
          {
            type: "input_text",
            text: `This is a multi-page genomic report PDF (commonly 60-90+ pages). Visually inspect EVERY SINGLE PAGE, from the first page to the last, as an image — do not rely on any embedded/extracted text layer alone, since some fields (including colored risk badges and the UID) are rendered graphically and have no text-layer equivalent, and do not stop scanning after the first few pages. Every section of the schema below lives on its own pages later in the document — go through the entire PDF page by page and populate each section from the pages where it actually appears, not just from page 1. Treat this as a careful transcription task, not a summarization task: do not paraphrase, estimate, or recall a "typical" report from memory — only report what is actually visible on the page in front of you.

CRITICAL ACCURACY RULES — read these before extracting anything:

1. RISK LEVELS MUST MATCH THE DOCUMENT EXACTLY. Each condition's risk level (Low / Mild / Moderate / Moderate to high / High) is shown as a specific colored pill or bar segment on the "RISK GLOSSARY OF MEDICAL CONDITIONS" pages and/or on that condition's own detail page. For every single condition, look directly at its risk indicator on the page — do not infer risk from the condition's name, from what's "usually" true for that condition, or from a similar-sounding condition elsewhere in the document. If you are not certain which color/label applies to a specific condition, re-examine that exact page region before answering. Getting a risk level wrong (e.g. reporting "Mild" when the page clearly shows "Low") is a critical error.

2. EXTRACT EVERY MEDICATION, NOT A SAMPLE. The pharmacogenomics section lists many individual drug/medication cards, each with its own gene, diplotype, phenotype, and recommendation. Go through every page of this section and include EVERY drug mentioned — do not stop after the first few or pick only "representative" examples. The same applies to condition_risk_overview (every condition in the glossary) and medical_recommendations (every condition with a dedicated recommendations page).

3. LIFESTYLE SECTIONS ARE OFTEN UNDER-EXTRACTED — BE THOROUGH, AND NEVER SUBSTITUTE A SUMMARY FOR THE ITEMIZED LIST. "vitamins_and_minerals" and "fitness_and_nutrigenomics" each have dedicated pages with specific, itemized, extractable content — they are not optional or summary sections.

The document has a page titled (or similarly titled) "Vitamins and Minerals Summary" — despite the word "Summary" in its title, this page is NOT a prose overview to condense into one sentence. It contains an itemized breakdown of individual vitamins/minerals/nutrients, with each item showing its name, the genetic reason it's recommended, and a specific dose/amount. You MUST scrape every individual vitamin/mineral/nutrient row from this page into "vitamins_and_minerals" as structured data — a single {"summary": "..."} string field describing the page in general terms is NEVER an acceptable output, even if the page also has introductory prose above the itemized rows.

CRITICAL — DO NOT ASSUME OR INVENT TIER NAMES. Vision-inspect each item's own row/badge/section header on the page and use ONLY the literal tier label actually printed there for that specific item. "Essential", "Advised", and "Optional" are common tier names in reports like this, but they are NOT guaranteed to be the tiers used in every document, and not every report tiers its vitamins at all — some show a single flat list with no tier grouping whatsoever. Do not default to a 3-tier "Essential/Advised/Optional" scheme out of habit or because it's a common pattern; if the page shows different tier names (or none), use exactly what is shown, or omit "tier" entirely if the page doesn't group items into tiers. Getting an item's tier wrong (e.g. labeling something "Essential" when its actual on-page badge says something else, or when the page has no tiers at all) is a critical error — re-examine the exact page region for that item before assigning a tier.

For vitamins_and_minerals, produce an array of objects (or an object keyed by tier if the document itself visibly groups them into tiers), each item with: "name" (the exact vitamin/mineral/nutrient name, e.g. "Vitamin D3", "Folate (5-MTHF)"), "tier" (the exact tier label printed on the page for this specific item, verified by looking directly at it — omit this field if the page shows no tier for it), "why" (the short genetic reason shown next to it, e.g. "VDR variant · lower baseline"), and "dose" (the exact recommended dose/amount shown, e.g. "2000 IU"). Extract every single item shown across every tier (or across the flat list, if untiered) — do not stop after the first tier/section or sample a subset.

If — and only if — the document's own tiers are named "Essential", "Advised", and "Optional" (verified per-item as above, not assumed), emit them in that order (Essential, then Advised, then Optional), since that matches the order they appear on the page in reports that use this scheme. Do not force this specific three-tier scheme onto a document that visibly uses different tier names or no tiers.

A TIER SECTION HEADER CAN BE PRESENT ON THE PAGE WITH ZERO ITEMS LISTED UNDER IT — this is common and completely valid; it is NOT a signal to invent items for that tier or to move items from a different tier into it. Some reports show all three headers ("Essential", "Advised", "Optional") as a visual layout element (e.g. a body-outline diagram with each tier as a labeled body region) even when one or more of those regions has no vitamins/minerals actually printed beneath it — in that case, that tier gets ZERO items in your output (an empty array, or simply omit that key), while the OTHER tiers still get every item genuinely listed under them. Do NOT redistribute items to make every tier look populated, and do NOT assign an item to "Essential" just because that header exists on the page — every item's tier assignment must come from which section it is physically printed under, nothing else. Before finalizing, check: for each tier header on the page, did I only include items that are actually listed directly beneath that specific header, with none invented or moved from elsewhere?

"food_sensitivity" MUST ALWAYS BE POPULATED — it is not optional. Its source is the document's "Your Metabolism" section (or similarly named nutrigenomics/intolerance section), which typically lists several named sensitivities/intolerances such as "Lactose Intolerance", "Gluten Intolerance", "Insulin Resistance", "Caffeine sensitivity", etc. — this section reliably exists in these reports and MUST be scraped into "food_sensitivity" as an array of objects, one per sensitivity/intolerance listed, each with whatever fields that section actually shows for it (a name, the genetic basis/gene if shown, and the sensitivity level/risk shown). Do not omit any individual sensitivity shown, and do not leave "food_sensitivity" empty if this section exists in the document — an empty array here is only acceptable if the document genuinely has no such section at all. "musculoskeletal" as an object with the fitness/muscle-type profile info actually shown (narrative, risk/level, recommendations).

The document has a page titled (or similarly titled) "Tailored Fitness: Musculoskeletal Resilience for Every Step". This page contains MULTIPLE subsections, commonly including "Medical Recommendations", "Diet and Nutrition", and "Exercise". The schema field "exercise" must be scraped ONLY from the "Exercise" subsection of THIS "Tailored Fitness" page — not from "Medical Recommendations" (that belongs in medical_recommendations/condition_risk_overview instead), not from "Diet and Nutrition" (that belongs in diet_plan instead), and not from the document's separate "Your Metabolism" section (that section's own content, e.g. "Carbohydrate Intolerance", metabolic-pathway/enzyme narrative text, belongs nowhere in this schema and should be left out of every field — EXCEPT that its list of named sensitivities/intolerances, as described above, DOES belong in "food_sensitivity"). Pulling "Your Metabolism" narrative/pathway content into "exercise" (or any field other than "food_sensitivity") is a mistake, even if it appears on the same page or under a similarly-named heading — but do not let this caution cause you to skip extracting its sensitivity list into "food_sensitivity", which is required.

The JSON KEY for this array MUST be exactly "exercise" — NOT "metabolism". Older versions of this schema used the key "metabolism" for this same data; that name has been retired and replaced with "exercise". Do not emit a key called "metabolism" anywhere in fitness_and_nutrigenomics — the correct, current, exact property name is "exercise".

For "exercise", TRANSCRIBE — DO NOT INTERPRET, SUMMARIZE, PARAPHRASE, OR MERGE. Produce one array item per bullet point exactly as it appears in the Exercise subsection (e.g. separate bullets like "Frequency - 4 days per week.", "Intensity - Moderate.", "Time - 30 minutes.", "Type - ...", "Precautions - ..." each become their own array item, in the same order, with the same wording — not rewritten into a single combined sentence). Each item's "recommendation" field must be the bullet's exact text copied verbatim, character-for-character where legible, with no added interpretation, no combining multiple bullets into one, and no omitted bullets. If the subsection has 6 bullet points, "exercise" must have 6 items.

CONCRETE NEGATIVE EXAMPLE — a bullet like "Monitor for micronutrients and other nutritional deficiencies, specifically magnesium, calcium, and vitamin D. Replenish them as required." is Medical Recommendations content (about nutrient deficiencies/supplementation), NOT Exercise content — it must NOT appear in "exercise" even though it may sit near the Exercise subsection on the page. Before including any bullet in "exercise", check: is this bullet actually about physical activity/movement (frequency, intensity, duration, activity type, physical precautions like hydration/sleep/warm-up)? If it's instead about nutrients, deficiencies, diet, or medications, it belongs in a different field (or nowhere in this schema) — leave it out of "exercise".

If any of these pages exist in the document, this itemized data MUST be present in your output — an empty array or missing field here is only acceptable if that section is genuinely absent from the PDF.

Extract the data as JSON matching this schema:\n\n${JSON.stringify(
              REPORT_JSON_SCHEMA,
              null,
              2
            )}\n\nThe "uid" field is a standalone "UID - <value>" line on page 1, directly below the Name/Age/Gender row, visible only in the rendered page image. It is a different field from "Genomic Specimen ID" under Sample Details (which is often blank) — do not confuse them.\n\nRespond with ONLY the JSON object, no other text.`,
          },
        ],
      },
    ],
  });

  const text = response.output_text;
  if (!text) {
    throw new IngestError("No text response from model", 502);
  }

  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(text);
  } catch {
    // Defense in depth on top of the json_object response format above:
    // strip markdown code fences some models still add, and fall back to
    // the largest {...} substring if there's stray prose around the JSON.
    const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    try {
      rawParsed = JSON.parse(stripped);
    } catch {
      const match = stripped.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new IngestError("Model did not return valid JSON", 502);
      }
      try {
        rawParsed = JSON.parse(match[0]);
      } catch {
        throw new IngestError("Model did not return valid JSON", 502);
      }
    }
  }

  const validation = reportDataSchema.safeParse(rawParsed);
  if (!validation.success) {
    throw new IngestError("Parsed JSON failed validation", 422, validation.error.issues);
  }

  const { uid, ...data } = validation.data;

  await sql`
    INSERT INTO reports (uid, data, updated_at)
    VALUES (${uid}, ${JSON.stringify(data)}::jsonb, now())
    ON CONFLICT (uid) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;

  return { uid };
}
