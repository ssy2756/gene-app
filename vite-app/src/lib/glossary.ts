import type { DisplayReport } from "./report-mapping";

// Static definitions for common pharmacogenomic / genetics terms, ported
// from the GenepowerX design prototype. Gene names found in the report
// itself (medications, gene panel, conditions) are added automatically at
// runtime with a generic fallback definition if they aren't already here.
export const GLOSSARY: Record<string, string> = {
  "CYP2C19": "A liver enzyme that breaks down (metabolises) many common drugs, including some antiplatelets, antidepressants and acid reducers. Your version affects how quickly they are processed.",
  "CYP2D6": "A liver enzyme responsible for metabolising about a quarter of prescription drugs, including some painkillers and beta-blockers.",
  "CYP2C9": "A liver enzyme that clears drugs such as warfarin and many NSAIDs. Reduced activity means slower clearance.",
  "CYP1A2": "The main enzyme that clears caffeine. Slow metabolisers feel caffeine's effects for longer.",
  "SLCO1B1": "A transporter that moves statins from the blood into the liver. Reduced function raises statin levels and muscle-related side-effect risk.",
  "VKORC1": "The protein warfarin acts on. Certain variants make you more sensitive to warfarin, needing a lower dose.",
  "APOE": "A gene involved in fat transport and brain health. The ε4 form is the strongest common genetic factor for late-onset Alzheimer's, but it is a risk factor, not a diagnosis.",
  "HLA-B": "An immune-system gene. Specific versions (like *58:01) can predict severe reactions to certain drugs.",
  "AGT": "Angiotensinogen — a gene in the pathway that regulates blood pressure.",
  "CFH": "Complement factor H — variants influence risk of age-related macular degeneration.",
  "TCF7L2": "The gene most strongly linked to type 2 diabetes risk; it affects insulin release.",
  "MTHFR": "A gene involved in folate metabolism. Reduced-function variants can lower the conversion of folic acid into its active form.",
  "ACTN3": "A gene affecting muscle fiber composition, associated with power vs. endurance athletic performance.",
  "LCT": "The gene for lactase, the enzyme that digests milk sugar. Non-persistence variants reduce lactase production into adulthood.",
  "Intermediate metabolizer": "You process the drug more slowly than average because one gene copy has reduced activity. Standard doses may build up or, for prodrugs, work less well.",
  "Normal metabolizer": "You process the drug at the expected rate, so standard dosing usually works as intended.",
  "Poor metabolizer": "You process the drug much more slowly than average. Standard doses can build up to higher-than-expected levels.",
  "Ultrarapid metabolizer": "You process the drug much faster than average. Standard doses may clear too quickly to be effective, or convert prodrugs too effectively.",
  "Decreased function": "The transporter or enzyme works less efficiently than usual, typically raising drug levels in the blood.",
  "Metabolizer": "A term describing how fast your body processes a drug, based on your enzyme genes — from poor (slowest) to ultrarapid (fastest).",
  "Diplotype": "The pair of gene versions you inherited (one from each parent), written like *1/*2. It determines your predicted metaboliser status.",
  "Genotype": "The specific combination of gene variants you carry at a given location in your DNA.",
  "Phenotype": "The observable trait or predicted function that results from your genotype — e.g. \"Intermediate metabolizer.\"",
  "Heterozygous": "Carrying two different versions of a gene — one from each parent. The opposite is homozygous (two identical copies).",
  "Homozygous": "Carrying two identical copies of a gene version, one from each parent.",
  "Polygenic risk score": "A single number that adds up the small effects of many genetic variants to estimate your overall inherited risk for a condition.",
  "Evidence level": "How strong the research is behind a gene–drug link. Level 1A is the highest — backed by clinical guidelines such as CPIC.",
  "Biomarker": "A measurable gene, protein, or other molecule used to evaluate risk, diagnosis, or drug response.",
  "Variant": "A difference in DNA sequence compared to a reference genome — the raw material that diplotypes and risk scores are built from.",
  "Germline": "Genetic material inherited from your parents and present in every cell — as opposed to mutations acquired later in specific tissues (somatic).",
};

function genericGeneDefinition(gene: string): string {
  return `${gene} is one of the genes analyzed in your report. Its variants can influence how your body processes certain drugs or your risk for certain conditions.`;
}

// Builds a full term -> definition map for a given report: static GLOSSARY
// entries plus every gene mentioned in medications/gene panel/conditions
// that isn't already covered, using a generic fallback definition.
export function buildGlossary(report: DisplayReport): Record<string, string> {
  const glossary = { ...GLOSSARY };
  const genes = new Set<string>();

  report.genePanel.forEach((g) => genes.add(g.gene));
  report.medications.forEach((m) => m.gene.split(/[·,]/).forEach((g) => genes.add(g.trim())));

  genes.forEach((gene) => {
    const key = gene.trim();
    if (!key || key === "—") return;
    if (!glossary[key]) glossary[key] = genericGeneDefinition(key);
  });

  return glossary;
}
