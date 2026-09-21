/**
 * Scores the trained chatbot on two held-out test sets.
 *
 *   npm run eval:chatbot            # evaluates model.json
 *   npm run eval:chatbot -- --verbose
 *
 * Set 1 (evalSet.ts) was used for error analysis while building the bot, so it
 * is optimistic. Set 2 (evalSetFresh.ts) was written cold for the earlier 92-topic model.
 * Set 3 (evalSetCold3.ts) was written cold for the current model and is the
 * honest estimate. Exits non-zero if either set falls below the quality bar, so it can
 * gate CI or a pre-commit hook.
 */
import { loadModel } from "../services/chatbot/modelStore";
import { decide, rank } from "../services/chatbot/matcher";
import { evalSet, type EvalCase } from "../services/chatbot/evalSet";
import { evalSetFresh } from "../services/chatbot/evalSetFresh";
import { evalSetCold3 } from "../services/chatbot/evalSetCold3";

// Regression guard, not a claim of quality: fails if a change makes the bot clearly worse.
const MIN_IN_SCOPE_ACCURACY = 0.75;
const MIN_REJECTION = 0.85;

const verbose = process.argv.includes("--verbose");
const model = loadModel();

function evaluate(name: string, cases: EvalCase[]) {
  let inScope = 0;
  let top1 = 0;
  let helpful = 0;
  let answered = 0;
  let offTopic = 0;
  let rejected = 0;
  const failures: string[] = [];

  for (const c of cases) {
    const ranked = rank(c.q, model);
    const top = ranked[0];
    const decision = decide(ranked, model);
    const accepted = decision.kind === "answer";

    if (c.expect === null) {
      offTopic++;
      if (!accepted) rejected++;
      else failures.push(`✗ [off-topic answered] "${c.q}" → ${top.target} (${top.score.toFixed(2)})`);
      continue;
    }

    inScope++;
    const ok = accepted && top.target === c.expect;
    if (ok) top1++;
    if (accepted) answered++;
    // "Helpful" = right answer, or the right topic offered as a "did you mean" suggestion.
    if (ok || (decision.kind === "suggest" && decision.matches.some((m) => m.target === c.expect))) helpful++;
    if (!ok) {
      failures.push(
        `✗ "${c.q}" expected ${c.expect}, got ${top ? `${top.target} (${top.score.toFixed(2)})` : "nothing"}` +
          (accepted ? "" : ` [${decision.kind}]`)
      );
    } else if (verbose) {
      console.log(`✓ "${c.q}" → ${top.target} (${top.score.toFixed(2)})`);
    }
  }

  console.log(`\n──────── ${name} ────────`);
  failures.forEach((f) => console.log(f));
  console.log(`in-scope            : ${inScope}`);
  console.log(`  top-1 accuracy    : ${((top1 / inScope) * 100).toFixed(1)}%  (${top1}/${inScope})`);
  console.log(`  right answer or right suggestion: ${((helpful / inScope) * 100).toFixed(1)}%`);
  console.log(`  answered at all   : ${((answered / inScope) * 100).toFixed(1)}%`);
  console.log(`off-topic           : ${offTopic}`);
  console.log(`  correctly declined: ${((rejected / offTopic) * 100).toFixed(1)}%  (${rejected}/${offTopic})`);
  return { acc: top1 / inScope, rej: rejected / offTopic };
}

console.log(`threshold ${model.threshold} · confident ${model.confidentThreshold} · trained ${model.trainedAt}`);
const first = evaluate("test set 1 (used for error analysis — optimistic)", evalSet);
const fresh = evaluate("test set 2 (written cold — honest estimate)", evalSetFresh);

const cold3 = evaluate("test set 3 (written cold for the 147-topic model — honest estimate)", evalSetCold3);

const bad = [first, fresh, cold3].some((r) => r.acc < MIN_IN_SCOPE_ACCURACY || r.rej < MIN_REJECTION);
if (bad) {
  console.error(
    `\n❌ Below bar (need ≥${MIN_IN_SCOPE_ACCURACY * 100}% accuracy and ≥${MIN_REJECTION * 100}% rejection on both sets)`
  );
  process.exit(1);
}
console.log("\n✅ Meets quality bar");
