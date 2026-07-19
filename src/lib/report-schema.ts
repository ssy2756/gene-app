// PLACEHOLDER JSON SCHEMA
//
// Replace this with the real schema once it's provided. It's used both to
// instruct Claude on how to structure the extracted PDF data, and to
// validate the response before storing it.

export const REPORT_JSON_SCHEMA = {
  type: "object",
  properties: {
    uid: { type: "string" },
  },
  required: ["uid"],
  additionalProperties: true,
} as const;
