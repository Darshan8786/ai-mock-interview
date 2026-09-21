import type { Decision } from "./matcher";

/**
 * Combine the fine-tuned neural matcher with the keyword (TF-IDF) matcher.
 *
 * The neural model understands paraphrases far better; the keyword model is
 * better at heavily misspelled words (it snaps them to known vocabulary).
 * Measured on the held-out sets (`npm run eval:hybrid`), this rule is never
 * worse than neural alone and recovers many typo cases:
 *
 *  - If the neural model is not confident but the keyword model is → keyword.
 *  - Otherwise → neural. An off-topic (declined) neural result is never
 *    overridden by a mere keyword suggestion.
 *
 * (Merging the two models' "did you mean" candidates was tried and gave no
 * measurable gain, so it is deliberately not part of the rule.)
 */
export function fuseDecisions(neural: Decision, keyword: Decision): Decision {
  const neuralSure = neural.kind === "answer" && neural.confident;
  const keywordSure = keyword.kind === "answer" && keyword.confident;
  return !neuralSure && keywordSure ? keyword : neural;
}
