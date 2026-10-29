export type PromptTemplate<Vars> = {
  /** Stable identifier, e.g. "analyze-idea". */
  id: string;
  /** Bump when the wording changes so stored outputs can be traced to the prompt that made them. */
  version: string;
  system: string;
  render: (vars: Vars) => string;
  maxTokens: number;
  temperature: number;
};
