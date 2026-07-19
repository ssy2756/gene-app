// PLACEHOLDER MAPPING LAYER
//
// This projects the full parsed-PDF JSON (stored in `reports.data`) down to
// only the fields the frontend needs to display. Once the real JSON schema
// and UI/asset folder are provided, replace `RawReport` and `mapReportForDisplay`
// below with the actual field names and shape the UI components expect.

export type RawReport = Record<string, unknown>;

export type DisplayReport = {
  uid: string;
  // TODO: replace with real fields once the JSON schema is provided.
  [key: string]: unknown;
};

export function mapReportForDisplay(uid: string, raw: RawReport): DisplayReport {
  return {
    uid,
    ...raw,
  };
}
