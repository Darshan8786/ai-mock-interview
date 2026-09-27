"""
v2 - build the COMBINED interview + aptitude + tech training dataset (clean, verify, de-duplicate, split, report).

    python training/build_multidomain_dataset.py            # from ai-services/interviewer_llm

Inputs (never modified):
  interview  data/processed/interview_cleaned.jsonl (the v1 cleaned set, with its v1 split kept as-is) +
             ../training/data/interview_questions/hr_behavioral_dataset.json (+ raw_dataset.json / topic_concepts.json
             for skill/topic/expected concepts)
  aptitude   ../training/data/aptitude_questions/seed_export.json   (placement-prep-be seed banks, exported by
             src/scripts/exportAptitudeDataset.ts) + correct-by-construction items from aptitude_templates.py
  tech       ../training/data/tech_questions/<technology>.json      (the verified tech-practice dataset)

Outputs (data/v2_combined/):
  combined_clean.jsonl      every accepted record (all domains, normalised)
  rejected.jsonl            every rejected record with its reason(s)
  aptitude_bank.jsonl       accepted aptitude seed records - the verified offline bank the runtime engine falls back to
  train/validation/test.jsonl  instruction examples (tasks qgen_interview / qgen_aptitude / qgen_tech / mcq_answer)
  SPLIT_MANIFEST.json       counts + sha256 of each split (train.py / evaluate_v2.py refuse to run if a split changes)
  ../reports/v2_dataset_report.{json,txt}

Cleaning (records are REJECTED, never silently fixed, when): empty/short/malformed, not exactly 4 distinct options,
answer not exactly one option, missing explanation, missing concepts (tech), debugging item without buggy+fixed code,
a numerical aptitude answer key the deterministic verifier CONTRADICTS (numeric_verifier.py), exact or near-duplicate
of an earlier record. Difficulty, topic and technology names are normalised to one vocabulary.

Leakage: the interview domain keeps its v1 split (so the v1 locked test set is still test data here); every other
record is split 80/10/10 stratified by (domain, topic), and a final check re-scans every cross-split pair for exact or
near-duplicate questions and fails the build if it finds one.
"""
from __future__ import annotations

import argparse
import collections
import json
import random
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent.parent))          # ai-services/  (for the interviewer_llm package)

from common import PROCESSED, REPORTS, ROOT, norm, read_jsonl, sha256, similar, stable_int, write_jsonl  # noqa: E402
import prompting  # noqa: E402
from interviewer_llm import aptitude_templates  # noqa: E402
from interviewer_llm.numeric_verifier import is_numeric_question, verify_numeric_mcq  # noqa: E402
from interviewer_llm.structured_validator import norm_difficulty, validate_structured  # noqa: E402

AI_ROOT = ROOT.parent
OUT = ROOT / "data" / "v2_combined"
APT_DIR = AI_ROOT / "training" / "data" / "aptitude_questions"
TECH_DIR = AI_ROOT / "training" / "data" / "tech_questions"
IQ_DIR = AI_ROOT / "training" / "data" / "interview_questions"
TECH_FILES = {"Python": "python", "Java": "java", "SQL": "sql", "C++": "cpp", "C": "c", "HTML": "html", "CSS": "css",
              "JavaScript": "javascript", "React": "react", "Node.js": "nodejs"}
TECH_TYPE_MAP = {"MCQ": "mcq", "Conceptual": "conceptual", "Technical": "conceptual", "Scenario Based": "conceptual",
                 "Output Prediction": "output_prediction", "Debugging": "debugging", "Coding": "coding",
                 "Programming Problem": "coding", "SQL Query": "coding"}
INTERVIEW_TYPE_MAP = {"conceptual": "technical", "scenario": "scenario", "task": "coding", "design": "system_design"}
# live seed arrays first, so when two copies of a question exist the one actually served by the app is kept
SEED_PRIORITY = ["quantSeed1", "quantSeed2", "logicalSeed1", "logicalSeed2", "verbalSeed1", "verbalSeed2", "diSeed2",
                 "quantSeed", "logicalSeed", "verbalSeed", "diSeed"]
APT_ALIASES = {
    "percentage": "Percentages", "profit and loss": "Profit Loss & Discount", "average": "Averages",
    "problems on trains": "Time Speed & Distance", "mixtures and alligation": "Mixtures & Allegations",
    "trigonometry": "Geometry", "logarithms": "Algebra", "decimals and fractions": "Simplification",
    "surds and indices": "Simplification", "coding decoding": "Coding & Decoding", "analogy": "Analogies",
    "synonyms": "Synonyms & Antonyms", "antonyms": "Synonyms & Antonyms", "spelling": "Vocabulary",
    "idioms and phrases": "Vocabulary", "one word substitution": "Vocabulary", "letter series": "Alphabet Series",
    "ranking and order": "Ranking & Ordering", "logical connectives": "Statement & Conclusion",
    "logical venn diagrams": "Venn Diagrams", "cause and effect": "Statement & Conclusion",
    "spotting errors": "Error Detection", "sentence arrangement": "Para Jumbles", "cloze test": "Fill in the Blanks",
    "mixed graphs": "Data Comparison", "missing data di": "Tables", "data sufficiency (di)": "Data Comparison",
}
MAX_OUTPUT_CHARS = 1500          # longer targets (big coding solutions) stay in the bank but are not trained on
TEMPLATE_ITEMS_PER_CELL = 8      # correct-by-construction aptitude items per (topic, difficulty) added to training


def _key(name: str) -> str:
    return re.sub(r"[^a-z&]", "", name.lower().replace(" and ", " & ").replace(",", ""))


def load_catalog() -> dict[str, tuple[str, str]]:
    cat = json.loads((APT_DIR / "topic_catalog.json").read_text(encoding="utf-8"))
    return {_key(t["name"]): (t["category"], t["name"]) for t in cat}


# ── interview ──────────────────────────────────────────────────────────────────
_STOP = set("the a an of to in and or is are what how why when which with for on be by as it its this that from can "
            "does do you your between difference explain describe used use using".split())


def _answer_keywords(answer: str, n: int = 4) -> list[str]:
    words = [w for w in re.findall(r"[a-zA-Z][a-zA-Z+#\-]{3,}", answer or "") if w.lower() not in _STOP]
    out: list[str] = []
    for w in words:
        if w.lower() not in (x.lower() for x in out):
            out.append(w.lower())
        if len(out) == n:
            break
    return out


def build_interview(rejected: list[dict]) -> list[dict]:
    v1_split: dict[str, str] = {}
    for name in ("train", "validation", "test"):
        for ex in read_jsonl(PROCESSED / f"{name}.jsonl"):
            v1_split[ex["id"]] = name
    raw = json.loads((IQ_DIR / "raw_dataset.json").read_text(encoding="utf-8"))
    curated = {norm(r["question"]): r for r in raw}
    concepts = json.loads((IQ_DIR / "topic_concepts.json").read_text(encoding="utf-8"))
    out = []
    for r in read_jsonl(PROCESSED / "interview_cleaned.jsonl"):
        cur = curated.get(norm(r["question"]))
        skill = cur["skill"] if cur else r["topic"]
        topic = cur["topic"] if cur else (r.get("subtopic") or "")
        ref = concepts.get(skill, {}).get(topic, [])
        text = (r["question"] + " " + (r.get("answer") or "")).lower()
        expected = [c for c in ref if c.lower() in text][:5] or ref[:4] or _answer_keywords(r.get("answer") or "")
        rec = {"id": r["id"], "domain": "interview", "skill": skill, "topic": topic,
               "difficulty": norm_difficulty(r.get("difficulty")), "question_type": INTERVIEW_TYPE_MAP.get(r.get("question_type"), "technical"),
               "question": r["question"], "expected_concepts": expected, "source": r["source"],
               "fixed_split": v1_split.get(r["id"])}
        out.append(rec)
    for i, r in enumerate(json.loads((IQ_DIR / "hr_behavioral_dataset.json").read_text(encoding="utf-8")), 1):
        kind = str(r.get("interview_type", "HR"))
        out.append({"id": f"hrb-{i:04d}", "domain": "interview", "skill": kind, "topic": "",
                    "difficulty": norm_difficulty(r.get("difficulty")), "question_type": "behavioral" if kind.lower().startswith("behav") else "hr",
                    "question": r["question"].strip(), "expected_concepts": list(r.get("concept_tags") or [])[:6],
                    "source": "hr_behavioral_dataset", "fixed_split": None})
    kept = []
    for rec in out:
        ctx = {"domain": "interview", "skill": rec["skill"], "topic": rec["topic"], "question_type": rec["question_type"]}
        v = validate_structured(rec, ctx, check_topic_vocab=False)
        # the v1 records were already cleaned; its runtime-only format limits (length cap, "?"-count) are not
        # reasons to drop real human-written questions
        hard = [x for x in v.reasons if x in ("empty_question", "question_too_short", "prompt_leak", "repetition", "empty")]
        if hard:
            rejected.append({**rec, "reasons": hard})
        else:
            kept.append(rec)
    return kept


# ── aptitude ───────────────────────────────────────────────────────────────────
def canonical_topic(category: str, topic: str, question: str, catalog) -> tuple[str, str]:
    hit = catalog.get(_key(topic))
    if hit:
        return hit
    if topic.lower() == "calendar and clocks":
        return ("Logical Reasoning", "Clocks" if "clock" in question.lower() or "hand" in question.lower() else "Calendars")
    alias = APT_ALIASES.get(topic.lower())
    if alias and catalog.get(_key(alias)):
        return catalog[_key(alias)]
    return (category, topic)


def build_aptitude(rejected: list[dict]) -> tuple[list[dict], collections.Counter]:
    catalog = load_catalog()
    seeds = json.loads((APT_DIR / "seed_export.json").read_text(encoding="utf-8"))
    seeds.sort(key=lambda r: (SEED_PRIORITY.index(r["source"]) if r["source"] in SEED_PRIORITY else 99, r["id"]))
    verification = collections.Counter()
    kept: list[dict] = []
    for r in seeds:
        category, topic = canonical_topic(r["category"], r["topic"], r["question"], catalog)
        opts = [str(o).strip() for o in r["options"]]
        idx = r["answer_index"]
        rec = {"id": r["id"], "domain": "aptitude", "category": category, "topic": topic, "subtopic": r.get("subtopic", ""),
               "difficulty": norm_difficulty(r["difficulty"]), "question_type": "mcq", "question": r["question"].strip(),
               "options": opts, "answer": opts[idx] if 0 <= idx < len(opts) else "", "explanation": r["explanation"].strip(),
               "companies": r.get("companies", []), "estimated_time": r.get("estimated_time", 60), "source": r["source"]}
        ctx = {"domain": "aptitude", "category": category, "topic": topic, "difficulty": rec["difficulty"], "question_type": "mcq"}
        v = validate_structured(rec, ctx)
        reasons = [x for x in v.reasons if x != "numeric_answer_unverifiable"]
        if reasons:
            rejected.append({**rec, "reasons": reasons, "details": v.details})
            continue
        rec = v.record
        rec["verification"] = v.verification if "numeric_answer_unverifiable" not in v.reasons else "unverified_human_authored"
        if not is_numeric_question(opts, category, topic):
            rec["verification"] = "human_authored_non_numeric"
        verification[rec["verification"]] += 1
        kept.append(rec)
    return kept, verification


def template_items(existing: list[dict]) -> list[dict]:
    items = []
    for topic in aptitude_templates.supported_topics():
        for diff in aptitude_templates.DIFFS:
            for i in range(TEMPLATE_ITEMS_PER_CELL):
                it = aptitude_templates.generate(topic, diff, random.Random(stable_int(f"{topic}|{diff}|{i}")))
                items.append({"id": f"tpl-{_key(topic)}-{diff}-{i:02d}", "domain": "aptitude", "category": it["category"],
                              "topic": topic, "subtopic": "", "difficulty": diff, "question_type": "mcq",
                              "question": it["question"], "options": it["options"], "answer": it["answer"],
                              "answer_index": it["answer_index"], "explanation": it["explanation"], "companies": [],
                              "estimated_time": it["estimated_time"], "source": "template", "verification": "deterministic"})
    return items


# ── tech ───────────────────────────────────────────────────────────────────────
def build_tech(rejected: list[dict]) -> tuple[list[dict], collections.Counter]:
    notes = collections.Counter()
    kept = []
    for tech, stem in TECH_FILES.items():
        for r in json.loads((TECH_DIR / f"{stem}.json").read_text(encoding="utf-8")):
            qtype = TECH_TYPE_MAP.get(r.get("question_type", ""))
            rec = {"id": r["id"], "domain": "tech", "technology": tech, "topic": str(r.get("topic", "")).strip(),
                   "difficulty": norm_difficulty(r.get("difficulty")), "question_type": qtype,
                   "question": str(r.get("question", "")).strip(), "explanation": str(r.get("explanation", "")).strip(),
                   "concepts": [str(k).strip() for k in r.get("keywords", []) if str(k).strip()], "source": "tech_dataset",
                   "original_type": r.get("question_type")}
            if qtype == "mcq":
                opts = r.get("options") or []
                ci = r.get("correct_option", -1)
                rec["options"] = opts
                rec["answer"] = opts[ci] if isinstance(ci, int) and 0 <= ci < len(opts) else ""
                stated = norm(str(r.get("answer", "")))
                if stated and rec["answer"] and not (norm(rec["answer"]) in stated or stated in norm(rec["answer"])
                                                     or len(set(stated.split()) & set(norm(rec["answer"]).split())) >= 1):
                    notes["mcq_answer_text_differs_from_keyed_option"] += 1
            elif qtype == "output_prediction":
                rec["code"], rec["answer"] = r.get("code_snippet", ""), str(r.get("answer", "")).strip()
            elif qtype == "debugging":
                rec["code"], rec["fixed_code"], rec["answer"] = r.get("buggy_code", ""), r.get("fixed_code", ""), str(r.get("answer", "")).strip()
            elif qtype == "coding":
                rec["starter_code"] = r.get("starter_code", "") or r.get("schema_context", "")
                rec["answer"] = str(r.get("expected_solution") or r.get("answer") or "").strip()
            else:
                rec["answer"] = str(r.get("answer", "")).strip()
            if qtype is None:
                rejected.append({**rec, "reasons": ["unknown_question_type"]})
                continue
            ctx = {"domain": "tech", "technology": tech, "topic": rec["topic"], "difficulty": rec["difficulty"], "question_type": qtype}
            v = validate_structured(rec, ctx)
            if v.reasons:
                rejected.append({**rec, "reasons": v.reasons})
                continue
            kept.append(v.record)
    return kept, notes


# ── de-duplication / split ─────────────────────────────────────────────────────
def _nums(text: str) -> tuple:
    return tuple(sorted(re.findall(r"\d+(?:\.\d+)?", text)))


def _near(a: dict, b: dict) -> bool:
    """Near-duplicate questions. Aptitude items that differ only in their numbers are DIFFERENT questions, so between
    two aptitude items a near-duplicate must also use the same numbers."""
    if a["domain"] == "aptitude" and b["domain"] == "aptitude" and _nums(a["question"]) != _nums(b["question"]):
        return False
    return similar(a["question"], b["question"])


def near_pairs(records: list[dict]):
    """Every near-duplicate pair, exhaustively: records sorted by normalised length and each compared with all later
    ones whose length is still inside common.similar()'s own 40% length gate."""
    order = sorted(range(len(records)), key=lambda i: len(norm(records[i]["question"])))
    lens = [len(norm(records[i]["question"])) for i in order]
    for x in range(len(order)):
        for y in range(x + 1, len(order)):
            if lens[y] - lens[x] > 0.4 * max(lens[y], 1):
                break
            a, b = records[order[x]], records[order[y]]
            if _near(a, b):
                yield order[x], order[y]


def dedupe(records: list[dict], rejected: list[dict]) -> list[dict]:
    """Drop exact duplicates anywhere, and near duplicates of an earlier record in the same domain AND the same
    technology/category (a C and a C++ version of a question are both kept - they are clustered for the split)."""
    by_key: dict[str, dict] = {}
    first: list[dict] = []
    for r in records:
        k = norm(r["question"]) + ("|" + "|".join(r.get("options", [])) if r["domain"] == "aptitude" else "")
        if k in by_key:
            rejected.append({**r, "reasons": ["exact_duplicate"], "duplicate_of": by_key[k]["id"]})
        else:
            by_key[k] = r
            first.append(r)
    drop: dict[int, int] = {}
    for i, j in near_pairs(first):
        a, b = first[i], first[j]
        if a["domain"] == b["domain"] and a.get("technology") == b.get("technology") and a.get("category") == b.get("category"):
            later, earlier = (j, i) if j > i else (i, j)        # keep the one that came first (source priority order)
            if earlier not in drop:
                drop.setdefault(later, earlier)
    for i, e in drop.items():
        rejected.append({**first[i], "reasons": ["near_duplicate"], "duplicate_of": first[e]["id"]})
    return [r for i, r in enumerate(first) if i not in drop]


def clusters(records: list[dict]) -> list[int]:
    """Union-find over near-duplicate pairs (any domain / technology) -> cluster id per record."""
    parent = list(range(len(records)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for i, j in near_pairs(records):
        parent[find(i)] = find(j)
    return [find(i) for i in range(len(records))]


def assign_splits(records: list[dict], seed: int) -> collections.Counter:
    """The split unit is a near-duplicate CLUSTER. A cluster holding a v1 interview record keeps that record's v1
    split (test > validation > train if a cluster joins several); every other cluster is split ~80/10/10 within its
    (domain, technology/category, topic) stratum."""
    rng = random.Random(seed)
    notes = collections.Counter()
    cid = clusters(records)
    members: dict[int, list[dict]] = collections.defaultdict(list)
    for c, r in zip(cid, records):
        members[c].append(r)
    strata: dict[tuple, list[int]] = collections.defaultdict(list)
    for c, rs in members.items():
        fixed = {r["fixed_split"] for r in rs if r["domain"] == "interview" and r.get("fixed_split")}
        if fixed:
            split = next(s for s in ("test", "validation", "train") if s in fixed)
            for r in rs:
                if r.get("fixed_split") and r["fixed_split"] != split:
                    notes["v1_interview_records_moved_to_keep_cluster_together"] += 1
                r["split"] = split
            continue
        head = min(rs, key=lambda x: x["id"])
        strata[(head["domain"], head.get("technology") or head.get("category") or head.get("skill"), head.get("topic"))].append(c)
    for key in sorted(strata, key=str):
        group = sorted(strata[key], key=lambda c: min(r["id"] for r in members[c]))
        rng.shuffle(group)
        total = sum(len(members[c]) for c in group)
        if total < 8:
            for c in group:
                for r in members[c]:
                    r["split"] = "train"
            continue
        want_test, want_val = max(1, round(total * 0.1)), max(1, round(total * 0.1))
        got = {"test": 0, "validation": 0}
        for c in group:
            split = "test" if got["test"] < want_test else "validation" if got["validation"] < want_val else "train"
            if split != "train":
                got[split] += len(members[c])
            for r in members[c]:
                r["split"] = split
    notes["clusters"] = len(members)
    notes["multi_record_clusters"] = sum(1 for rs in members.values() if len(rs) > 1)
    return notes


def leakage_problems(records: list[dict]) -> list[str]:
    """Independent re-scan: exact duplicates and EVERY near-duplicate pair (all domains) must share a split."""
    problems = []
    seen: dict[str, str] = {}
    for r in records:
        k = norm(r["question"])
        if k in seen and seen[k] != r["split"]:
            problems.append(f"identical question in {seen[k]} and {r['split']}: {r['question'][:80]!r}")
        seen.setdefault(k, r["split"])
    for i, j in near_pairs(records):
        a, o = records[i], records[j]
        if a["split"] != o["split"]:
            problems.append(f"near-duplicate across {a['split']}/{o['split']}: {a['question'][:70]!r} ~ {o['question'][:70]!r}")
    return problems


# ── examples ───────────────────────────────────────────────────────────────────
def context_of(r: dict) -> dict:
    if r["domain"] == "interview":
        return {"domain": "interview", "skill": r["skill"], "topic": r.get("topic"), "difficulty": r.get("difficulty"),
                "question_type": r["question_type"]}
    if r["domain"] == "aptitude":
        return {"domain": "aptitude", "category": r["category"], "topic": r["topic"], "difficulty": r["difficulty"], "question_type": "mcq"}
    return {"domain": "tech", "technology": r["technology"], "topic": r["topic"], "difficulty": r["difficulty"],
            "question_type": r["question_type"]}


def examples_for(r: dict, training: bool) -> tuple[list[dict], bool]:
    ctx = context_of(r)
    target = prompting.output_json(r, r["domain"], ctx["question_type"])
    base = {"id": r["id"], "domain": r["domain"], "topic": r.get("topic"), "difficulty": r.get("difficulty"),
            "question_type": ctx["question_type"]}
    if len(target) > MAX_OUTPUT_CHARS:
        return [], True
    out = [{**base, "task": prompting.qgen_v2_task(r["domain"]), "instruction": prompting.QGEN_V2_INSTRUCTION,
            "input": prompting.qgen_v2_input(ctx), "output": target}]
    if training and r["domain"] == "interview":
        # a second, partial prompt (like v1) so a caller that only knows the skill still gets a good question
        h = stable_int(r["id"] + ":v2")
        partial = dict(ctx)
        if h % 2 == 0:
            partial.pop("topic", None)
        if (h >> 2) % 2 == 0:
            partial.pop("difficulty", None)
        out.append({**base, "task": "qgen_interview", "instruction": prompting.QGEN_V2_INSTRUCTION,
                    "input": prompting.qgen_v2_input(partial), "output": target})
    if "options" in r and r.get("answer"):
        opts = list(r["options"])
        random.Random(stable_int(r["id"] + ":shuffle")).shuffle(opts)
        out.append({**base, "task": "mcq_answer", "instruction": prompting.MCQ_ANSWER_INSTRUCTION,
                    "input": prompting.mcq_answer_input(r["question"], opts), "output": r["answer"]})
    return out, False


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--force", action="store_true", help="overwrite an existing v2 split (invalidates earlier v2 evaluations)")
    args = ap.parse_args()
    if (OUT / "SPLIT_MANIFEST.json").exists() and not args.force:
        print("data/v2_combined already has a locked split. Re-run with --force only if you deliberately want to rebuild it.", file=sys.stderr)
        return 1

    rejected: list[dict] = []
    interview = build_interview(rejected)
    aptitude, apt_verification = build_aptitude(rejected)
    tech, tech_notes = build_tech(rejected)
    before = {"interview": len(interview), "aptitude_seed": len(aptitude), "tech": len(tech)}
    records = dedupe(interview + aptitude + template_items(aptitude) + tech, rejected)

    split_notes = assign_splits(records, args.seed)
    problems = leakage_problems(records)
    if problems:
        print("LEAKAGE CHECK FAILED:\n  " + "\n  ".join(problems[:15]), file=sys.stderr)
        return 2

    OUT.mkdir(parents=True, exist_ok=True)
    write_jsonl(OUT / "combined_clean.jsonl", records)
    write_jsonl(OUT / "rejected.jsonl", rejected)
    write_jsonl(OUT / "aptitude_bank.jsonl", [r for r in records if r["domain"] == "aptitude" and r["source"] != "template"])

    splits: dict[str, list[dict]] = {"train": [], "validation": [], "test": []}
    too_long = collections.Counter()
    for r in sorted(records, key=lambda x: (x["domain"], x["id"])):
        exs, skipped = examples_for(r, training=(r["split"] == "train"))
        if skipped:
            too_long[r["domain"]] += 1
        splits[r["split"]].extend(exs)
    rng = random.Random(args.seed)
    rng.shuffle(splits["train"])

    manifest = {"seed": args.seed, "records": {}, "examples": {}, "sha256": {},
                "leakage_check": "passed: no exact or near-duplicate question across splits",
                "note": "v2 combined interview+aptitude+tech split; test.jsonl is locked (hash-verified by train.py)."}
    for name, rows in splits.items():
        write_jsonl(OUT / f"{name}.jsonl", rows)
        manifest["examples"][name] = dict(collections.Counter(e["task"] for e in rows))
        manifest["records"][name] = dict(collections.Counter(r["domain"] for r in records if r["split"] == name))
        manifest["sha256"][name] = sha256(OUT / f"{name}.jsonl")
    (OUT / "SPLIT_MANIFEST.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    reject_reasons = collections.Counter(reason for r in rejected for reason in r["reasons"])
    by_domain_rej = collections.Counter(r["domain"] for r in rejected)
    report = {
        "total_accepted_records": len(records),
        "accepted_by_domain": dict(collections.Counter(r["domain"] for r in records)),
        "aptitude_template_records": sum(1 for r in records if r["source"] == "template"),
        "aptitude_verification": dict(collections.Counter(r.get("verification") for r in records if r["domain"] == "aptitude")),
        "accepted_before_dedupe": before,
        "rejected_total": len(rejected),
        "rejected_by_domain": dict(by_domain_rej),
        "rejected_reasons": dict(reject_reasons),
        "duplicates_removed": reject_reasons.get("exact_duplicate", 0) + reject_reasons.get("near_duplicate", 0),
        "split_records": manifest["records"],
        "split_examples": manifest["examples"],
        "not_trained_on_output_too_long": dict(too_long),
        "tech_notes": dict(tech_notes),
        "split_notes": dict(split_notes),
        "answer_key_rejections": [
            {"id": r["id"], "topic": r.get("topic"), "question": r["question"][:160], "reasons": r["reasons"], "details": r.get("details", [])}
            for r in rejected if r["domain"] == "aptitude" and any("contradict" in x or "duplicate_option" in x or x.startswith("explanation") or x == "no_option_matches_solver" or x == "solver_matches_other_option" for x in r["reasons"])
        ],
    }
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / "v2_dataset_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    lines = [f"{k}: {json.dumps(v, ensure_ascii=False)}" for k, v in report.items() if k != "answer_key_rejections"]
    lines.append("\nAptitude records rejected for a wrong / ambiguous answer key or inconsistent working:")
    for x in report["answer_key_rejections"]:
        lines.append(f"  - {x['id']} [{x['topic']}] {x['reasons']} {x['details']}\n      {x['question']}")
    (REPORTS / "v2_dataset_report.txt").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    print(f"\nwrote {OUT.relative_to(ROOT.parent)} and {REPORTS.relative_to(ROOT.parent)}/v2_dataset_report.*")
    return 0


if __name__ == "__main__":
    sys.exit(main())
