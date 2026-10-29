export type PersonaSample = {
  id: string;
  ordinal: number;
  name: string;
  age: number;
  profession: string | null;
  location: string | null;
  segmentKey: string;
};

export type PersonaJobSnapshot = {
  jobId: string;
  audienceId: string;
  status: "queued" | "generating" | "complete" | "failed" | "cancelled";
  total: number;
  completed: number;
  failed: number;
  error: string | null;
  segmentCounts: Record<string, number>;
  samples: PersonaSample[];
};
