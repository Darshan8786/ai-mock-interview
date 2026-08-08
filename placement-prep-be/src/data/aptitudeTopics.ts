export interface SeedTopic {
  category: "Quantitative" | "Logical Reasoning" | "Verbal Ability" | "Data Interpretation";
  name: string;
  description: string;
}

// Full aptitude syllabus — 64 topics (25 Quantitative + 17 Logical + 14 Verbal + 8 DI).
// Used to seed the AptitudeTopic collection and group the 1,000-question bank.
export const aptitudeTopics: SeedTopic[] = [
  // ── Quantitative Aptitude (25) ──
  { category: "Quantitative", name: "Number System", description: "Primes, divisibility, digit and base problems" },
  { category: "Quantitative", name: "HCF & LCM", description: "HCF, LCM and remainder-based problems" },
  { category: "Quantitative", name: "Simplification", description: "BODMAS, approximations and arithmetic tricks" },
  { category: "Quantitative", name: "Percentages", description: "Percent change, percentage-based word problems" },
  { category: "Quantitative", name: "Profit Loss & Discount", description: "Cost price, selling price, profit & discount" },
  { category: "Quantitative", name: "Ratio & Proportion", description: "Ratios, proportion, direct & inverse variation" },
  { category: "Quantitative", name: "Averages", description: "Averages, weighted averages" },
  { category: "Quantitative", name: "Problems on Ages", description: "Age relationships and linear equations" },
  { category: "Quantitative", name: "Time & Work", description: "Work rates, men-days problems" },
  { category: "Quantitative", name: "Pipes & Cisterns", description: "Fill and drain pipe problems" },
  { category: "Quantitative", name: "Time Speed & Distance", description: "Speed-distance-time, relative speed" },
  { category: "Quantitative", name: "Boats & Streams", description: "Upstream & downstream speed" },
  { category: "Quantitative", name: "Simple Interest", description: "Principal, rate, time calculations" },
  { category: "Quantitative", name: "Compound Interest", description: "Compounding and CI vs SI differences" },
  { category: "Quantitative", name: "Mixtures & Allegations", description: "Mixing of two or more ingredients" },
  { category: "Quantitative", name: "Partnership", description: "Profit sharing by investment & time" },
  { category: "Quantitative", name: "Probability", description: "Classical probability and events" },
  { category: "Quantitative", name: "Permutation & Combination", description: "Arrangements and selections" },
  { category: "Quantitative", name: "Algebra", description: "Expressions, identities, factorization" },
  { category: "Quantitative", name: "Linear Equations", description: "Two-variable equations and word problems" },
  { category: "Quantitative", name: "Quadratic Equations", description: "Roots, discriminant and factoring" },
  { category: "Quantitative", name: "AP & GP", description: "Arithmetic and geometric progressions" },
  { category: "Quantitative", name: "Geometry", description: "Triangles, polygons, angles, circles" },
  { category: "Quantitative", name: "Mensuration", description: "2D & 3D areas, perimeters, volumes" },
  { category: "Quantitative", name: "Data Interpretation", description: "Tables, graphs, charts & caselets" },

  // ── Logical Reasoning (17) ──
  { category: "Logical Reasoning", name: "Number Series", description: "Find next/missing term in numeric patterns" },
  { category: "Logical Reasoning", name: "Alphabet Series", description: "Alphabetic sequences and mixed series" },
  { category: "Logical Reasoning", name: "Coding & Decoding", description: "Letter/number substitution codes" },
  { category: "Logical Reasoning", name: "Blood Relations", description: "Family trees and relationship puzzles" },
  { category: "Logical Reasoning", name: "Direction Sense", description: "Distance and direction tracing" },
  { category: "Logical Reasoning", name: "Syllogisms", description: "Statements and conclusions / Venn logic" },
  { category: "Logical Reasoning", name: "Analogies", description: "Word and number analogies" },
  { category: "Logical Reasoning", name: "Odd One Out", description: "Identify the dissimilar element" },
  { category: "Logical Reasoning", name: "Statement & Conclusion", description: "Infer conclusions from statements" },
  { category: "Logical Reasoning", name: "Statement & Assumption", description: "Identify implicit assumptions" },
  { category: "Logical Reasoning", name: "Seating Arrangement", description: "Linear and circular arrangements" },
  { category: "Logical Reasoning", name: "Puzzles", description: "Multi-clue analytical puzzles" },
  { category: "Logical Reasoning", name: "Ranking & Ordering", description: "Position and ordering problems" },
  { category: "Logical Reasoning", name: "Data Sufficiency", description: "Decide which statements answer the question" },
  { category: "Logical Reasoning", name: "Venn Diagrams", description: "Set relationships and overlaps" },
  { category: "Logical Reasoning", name: "Clocks", description: "Clock angle and mirror-image problems" },
  { category: "Logical Reasoning", name: "Calendars", description: "Day-of-week and date problems" },

  // ── Verbal Ability (14) ──
  { category: "Verbal Ability", name: "Reading Comprehension", description: "Understand passages and infer meaning" },
  { category: "Verbal Ability", name: "Synonyms & Antonyms", description: "Words with similar / opposite meaning" },
  { category: "Verbal Ability", name: "Sentence Correction", description: "Grammatically correct sentences" },
  { category: "Verbal Ability", name: "Error Detection", description: "Identify the erroneous part" },
  { category: "Verbal Ability", name: "Fill in the Blanks", description: "Choose the correct word/phrase" },
  { category: "Verbal Ability", name: "Para Jumbles", description: "Arrange sentences into a coherent paragraph" },
  { category: "Verbal Ability", name: "Sentence Completion", description: "Complete the sentence logically" },
  { category: "Verbal Ability", name: "Grammar", description: "Parts of speech, subject-verb agreement" },
  { category: "Verbal Ability", name: "Vocabulary", description: "Word meaning and usage" },
  { category: "Verbal Ability", name: "Articles", description: "Use of a / an / the" },
  { category: "Verbal Ability", name: "Prepositions", description: "Correct preposition usage" },
  { category: "Verbal Ability", name: "Tenses", description: "Verb tense agreement" },
  { category: "Verbal Ability", name: "Active & Passive Voice", description: "Voice conversion" },
  { category: "Verbal Ability", name: "Direct & Indirect Speech", description: "Reported speech conversion" },

  // ── Data Interpretation (8) ──
  { category: "Data Interpretation", name: "Tables", description: "Read and compute from tabular data" },
  { category: "Data Interpretation", name: "Bar Graphs", description: "Compare values from bar charts" },
  { category: "Data Interpretation", name: "Line Graphs", description: "Trends and rate of change" },
  { category: "Data Interpretation", name: "Pie Charts", description: "Percentage and angle-based data" },
  { category: "Data Interpretation", name: "Caselets", description: "Text-based data scenarios" },
  { category: "Data Interpretation", name: "Percentage-based DI", description: "Percentage computations from data" },
  { category: "Data Interpretation", name: "Ratio-based DI", description: "Ratio computations from data" },
  { category: "Data Interpretation", name: "Data Comparison", description: "Compare data points and pick the best" },
];
