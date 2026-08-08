export type SeedCategory =
  | "Quantitative"
  | "Logical Reasoning"
  | "Verbal Ability"
  | "Data Interpretation";

export type SeedDifficulty = "beginner" | "intermediate" | "advanced";

export interface SeedQuestion {
  cat: SeedCategory;
  topic: string;
  subtopic?: string;
  diff: SeedDifficulty;
  q: string;
  opts: string[];
  a: number; // index of correct option
  exp: string;
  tags?: string[]; // company names -> stored with "*-style" tag
  time?: number; // estimated seconds
}
