"""
Generate verified company-wise aptitude questions so every company has at least TARGET questions.

    python scripts/generate_company_questions.py            (from ai-services/)

Questions come from interviewer_llm/aptitude_templates.py (correct-by-construction: the answer is computed from the
numbers, never parsed from text) and each one is ALSO checked by numeric_verifier - an item is only kept if both agree.
Every generated question is unique across the whole bank (it never equals an existing seed question or another
generated one) and belongs to exactly one company. Deterministic: the same seed always produces the same file.

Output: placement-prep-be/src/data/companyTemplateQuestions.json - loaded by `npm run seed:company` (add-only).
"""
from __future__ import annotations

import collections
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from interviewer_llm import aptitude_templates as T  # noqa: E402
from interviewer_llm.numeric_verifier import verify_numeric_mcq  # noqa: E402
from interviewer_llm.question_validator import normalize  # noqa: E402

TARGET = 200
MARGIN = 20                      # a little above the minimum, so retiring a bad question never drops a company below 200
SEED = 2026
SEEDS = ROOT / "training" / "data" / "aptitude_questions" / "seed_export.json"
LIVE_SOURCES = {"quantSeed1", "quantSeed2", "logicalSeed1", "logicalSeed2", "verbalSeed1", "verbalSeed2", "diSeed2"}
OUT = ROOT.parent / "placement-prep-be" / "src" / "data" / "companyTemplateQuestions.json"
DIFF_MIX = ["easy"] * 3 + ["medium"] * 4 + ["hard"] * 3          # 30 / 40 / 30
TO_DB = {"easy": "beginner", "medium": "intermediate", "hard": "advanced"}


def main() -> int:
    seeds = [r for r in json.loads(SEEDS.read_text(encoding="utf-8")) if r["source"] in LIVE_SOURCES]
    existing = collections.Counter(c for r in seeds for c in r["companies"])
    companies = sorted(existing, key=lambda c: (-existing[c], c))
    taken = {normalize(r["question"]) for r in seeds}
    rng = random.Random(SEED)
    topics = T.supported_topics()
    out: list[dict] = []
    report = {}

    for company in companies:
        need = max(0, TARGET + MARGIN - existing[company])
        made = 0
        per_topic = collections.Counter()
        attempts = 0
        while made < need and attempts < need * 200:
            attempts += 1
            topic = topics[attempts % len(topics)]           # round-robin: every company gets every topic
            diff = DIFF_MIX[rng.randrange(len(DIFF_MIX))]
            item = T.generate(topic, diff, rng)
            key = normalize(item["question"])
            if key in taken:
                continue
            v = verify_numeric_mcq(item["question"], item["options"], item["answer_index"], item["explanation"], topic)
            if v.status != "verified":                       # both code paths must agree, or the item is dropped
                continue
            taken.add(key)
            per_topic[topic] += 1
            made += 1
            out.append({
                "category": item["category"], "topic": topic, "difficulty": TO_DB[diff], "question": item["question"],
                "options": item["options"], "correctAnswer": item["answer_index"], "explanation": item["explanation"],
                "estimatedTime": item["estimated_time"], "company": company,
            })
        if made < need:
            print(f"ERROR: could only make {made}/{need} unique questions for {company}", file=sys.stderr)
            return 1
        report[company] = {"existing": existing[company], "added": made, "total": existing[company] + made,
                           "topics": len(per_topic)}

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    for c, r in report.items():
        print(f"{c:<10} existing {r['existing']:>3} + added {r['added']:>3} = {r['total']:>3}  ({r['topics']} topics)")
    print(f"\n{len(out)} verified, unique questions -> {OUT.relative_to(ROOT.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
