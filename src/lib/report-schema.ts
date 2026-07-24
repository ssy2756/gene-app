import { z } from "zod";

// Loose validator: enforces the fields storage/lookup depend on (uid,
// patient_information) while staying permissive on the deeply nested report
// sections, whose exact shape is produced by the deterministic extractor in
// src/lib/pdf-extract (see that module's header comment) rather than an
// LLM-driven schema.
export const reportDataSchema = z
  .object({
    uid: z.string().min(1, "Missing uid"),
    patient_information: z.record(z.string(), z.unknown()),
  })
  .catchall(z.unknown());

export type ReportData = z.infer<typeof reportDataSchema>;
