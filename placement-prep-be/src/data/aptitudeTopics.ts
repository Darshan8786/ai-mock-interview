export interface SeedTopic {
  category: "Quantitative" | "Logical Reasoning" | "Verbal Ability" | "Data Interpretation";
  name: string;
  description: string;
}

// Full aptitude syllabus — used to seed the AptitudeTopic collection.
export const aptitudeTopics: SeedTopic[] = [
  // ── Quantitative Aptitude ──
  { category: "Quantitative", name: "Percentage", description: "Percent change, percentage-based word problems" },
  { category: "Quantitative", name: "Profit and Loss", description: "Cost price, selling price, profit & discount" },
  { category: "Quantitative", name: "Simple Interest", description: "Principal, rate, time calculations" },
  { category: "Quantitative", name: "Compound Interest", description: "Compounding and CI vs SI differences" },
  { category: "Quantitative", name: "Average", description: "Averages, weighted averages" },
  { category: "Quantitative", name: "Ratio and Proportion", description: "Ratios, proportion, direct & inverse variation" },
  { category: "Quantitative", name: "Time and Work", description: "Work rates, men-days problems" },
  { category: "Quantitative", name: "Pipes and Cisterns", description: "Fill and drain pipe problems" },
  { category: "Quantitative", name: "Time, Speed and Distance", description: "Speed-distance-time, relative speed" },
  { category: "Quantitative", name: "Problems on Trains", description: "Trains, platforms, relative motion" },
  { category: "Quantitative", name: "Boats and Streams", description: "Upstream & downstream speed" },
  { category: "Quantitative", name: "Problems on Ages", description: "Age relationships and linear equations" },
  { category: "Quantitative", name: "Number System", description: "Primes, divisibility, digit problems" },
  { category: "Quantitative", name: "HCF and LCM", description: "HCF, LCM and remainder-based problems" },
  { category: "Quantitative", name: "Partnership", description: "Profit sharing by investment & time" },
  { category: "Quantitative", name: "Mixtures and Alligation", description: "Mixing of two or more ingredients" },
  { category: "Quantitative", name: "Permutation and Combination", description: "Arrangements and selections" },
  { category: "Quantitative", name: "Probability", description: "Classical probability and events" },
  { category: "Quantitative", name: "Mensuration", description: "2D & 3D areas, perimeters, volumes" },
  { category: "Quantitative", name: "Geometry", description: "Triangles, polygons, angles" },
  { category: "Quantitative", name: "Trigonometry", description: "Ratios, identities, heights & distances" },
  { category: "Quantitative", name: "Logarithms", description: "Log rules and exponential relations" },
  { category: "Quantitative", name: "Simplification", description: "BODMAS and basic arithmetic" },
  { category: "Quantitative", name: "Decimals and Fractions", description: "Fraction-decimal conversions" },
  { category: "Quantitative", name: "Surds and Indices", description: "Powers, roots and surd simplification" },
  { category: "Quantitative", name: "Calendar and Clocks", description: "Day-of-week and clock-angle problems" },

  // ── Logical Reasoning ──
  { category: "Logical Reasoning", name: "Number Series", description: "Find next/missing term in numeric patterns" },
  { category: "Logical Reasoning", name: "Letter Series", description: "Alphabetic sequences and mixed series" },
  { category: "Logical Reasoning", name: "Coding Decoding", description: "Letter/number substitution codes" },
  { category: "Logical Reasoning", name: "Blood Relations", description: "Family trees and relationship puzzles" },
  { category: "Logical Reasoning", name: "Direction Sense", description: "Distance and direction tracing" },
  { category: "Logical Reasoning", name: "Seating Arrangement", description: "Linear and circular arrangements" },
  { category: "Logical Reasoning", name: "Syllogisms", description: "Statements and conclusions / Venn logic" },
  { category: "Logical Reasoning", name: "Logical Venn Diagrams", description: "Set relationships and overlaps" },
  { category: "Logical Reasoning", name: "Analogy", description: "Word and number analogies" },
  { category: "Logical Reasoning", name: "Odd One Out", description: "Identify the dissimilar element" },
  { category: "Logical Reasoning", name: "Ranking and Order", description: "Position and ordering problems" },
  { category: "Logical Reasoning", name: "Data Sufficiency", description: "Decide which statements answer the question" },
  { category: "Logical Reasoning", name: "Statement and Conclusion", description: "Infer conclusions from statements" },
  { category: "Logical Reasoning", name: "Statement and Assumption", description: "Identify implicit assumptions" },
  { category: "Logical Reasoning", name: "Cause and Effect", description: "Relate cause-effect pairs" },
  { category: "Logical Reasoning", name: "Logical Connectives", description: "If-then, and/or/not logic" },
  { category: "Logical Reasoning", name: "Puzzles", description: "Multi-clue analytical puzzles" },

  // ── Verbal Ability ──
  { category: "Verbal Ability", name: "Synonyms", description: "Words with similar meaning" },
  { category: "Verbal Ability", name: "Antonyms", description: "Words with opposite meaning" },
  { category: "Verbal Ability", name: "Spelling", description: "Identify correct spellings" },
  { category: "Verbal Ability", name: "Sentence Correction", description: "Grammatically correct sentences" },
  { category: "Verbal Ability", name: "Spotting Errors", description: "Identify the erroneous part" },
  { category: "Verbal Ability", name: "Fill in the Blanks", description: "Choose the correct word/phrase" },
  { category: "Verbal Ability", name: "Sentence Arrangement", description: "Reorder parts into a logical sentence" },
  { category: "Verbal Ability", name: "Para Jumbles", description: "Arrange sentences into a coherent paragraph" },
  { category: "Verbal Ability", name: "Reading Comprehension", description: "Understand passages and infer meaning" },
  { category: "Verbal Ability", name: "Idioms and Phrases", description: "Meaning of common idioms" },
  { category: "Verbal Ability", name: "One Word Substitution", description: "Replace phrases with a single word" },
  { category: "Verbal Ability", name: "Cloze Test", description: "Fill blanks in a continuous passage" },
  { category: "Verbal Ability", name: "Prepositions", description: "Correct preposition usage" },
  { category: "Verbal Ability", name: "Active and Passive Voice", description: "Voice conversion" },
  { category: "Verbal Ability", name: "Direct and Indirect Speech", description: "Reported speech conversion" },

  // ── Data Interpretation ──
  { category: "Data Interpretation", name: "Tables", description: "Read and compute from tabular data" },
  { category: "Data Interpretation", name: "Bar Graphs", description: "Compare values from bar charts" },
  { category: "Data Interpretation", name: "Line Graphs", description: "Trends and rate of change" },
  { category: "Data Interpretation", name: "Pie Charts", description: "Percentage and angle-based data" },
  { category: "Data Interpretation", name: "Mixed Graphs", description: "Combined bar + line representations" },
  { category: "Data Interpretation", name: "Caselets", description: "Text-based data scenarios" },
  { category: "Data Interpretation", name: "Missing Data DI", description: "Fill gaps from totals and ratios" },
  { category: "Data Interpretation", name: "Data Sufficiency (DI)", description: "Data sufficiency based on charts/tables" },
];
