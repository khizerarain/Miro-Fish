import type { PromptTemplate } from "./types";

export const repairJsonV1: PromptTemplate<{ badOutput: string; error: string; jsonSchema: string }> = {
  id: "repair-json",
  version: "v1",
  maxTokens: 4000,
  temperature: 0,
  system:
    "You fix malformed JSON so it matches a JSON Schema. Keep the original content and meaning. Do not add commentary. Respond with the corrected JSON object only.",
  render: ({ badOutput, error, jsonSchema }) => `The following output failed validation.

<validation_errors>
${error}
</validation_errors>

<json_schema>
${jsonSchema}
</json_schema>

<output_to_fix>
${badOutput}
</output_to_fix>

Return only the corrected JSON object.`,
};
