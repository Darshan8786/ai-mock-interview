"""Realistic-examples matrix for the three generators, with the REAL v2 model loaded (integration check, not a unit test).

    HF_HUB_OFFLINE=1 python tests/generation_matrix.py        (from ai-services/; loads ~1 GB of weights on CPU)

Interview : several roles x interview types x difficulties through interview_question_service.generate_questions()
            (the exact function behind POST /generate-questions) - count, schema, no duplicates.
Aptitude  : 4 categories x several topics x easy/medium/hard - schema, 4 unique options, key index, difficulty/topic
            echoed, numeric keys re-verified independently, no duplicates within a simulated session.
Tech      : 10 technologies x question types x difficulties - schema per type, key present, no duplicates.
Prints a summary and exits non-zero on any violated invariant.
"""
import collections
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from interview_question_service import generate_questions  # noqa: E402
from interviewer_llm.numeric_verifier import is_numeric_question, verify_numeric_mcq  # noqa: E402
from question_engine import get_question_service  # noqa: E402

problems: list[str] = []
stats = collections.Counter()


def expect(cond, msg):
    stats["checks"] += 1
    if not cond:
        problems.append(msg)


def main() -> int:
    svc = get_question_service()
    llm = svc.llm
    llm._load()                                  # synchronous load for this script
    print("model:", json.dumps(llm.status()))
    expect(llm.loaded, f"v2 model failed to load: {llm.load_error}")
    expect(str(llm.model_dir).replace("\\", "/").endswith("models/v2_combined"), f"unexpected model dir {llm.model_dir}")

    # ── Interview ──
    t0 = time.time()
    for role, itype, diff, n in [("Backend Developer", "Technical", "Easy", 4), ("Frontend Developer", "Technical", "Medium", 4),
                                 ("Data Scientist", "Technical", "Hard", 3), ("Java Developer", "Technical", "Medium", 3),
                                 ("Software Engineer", "HR", "Easy", 3), ("Software Engineer", "Behavioral", "Medium", 3)]:
        r = generate_questions(job_role=role, experience_level="fresher", interview_type=itype, difficulty=diff, total_questions=n)
        qs = r.get("questions", [])
        expect(len(qs) == n, f"interview {role}/{itype}: {len(qs)} of {n} questions")
        expect(all(isinstance(q.get("question"), str) and len(q["question"]) > 10 for q in qs), f"interview {role}/{itype}: bad schema")
        expect(len({q["question"].strip().lower() for q in qs}) == len(qs), f"interview {role}/{itype}: duplicates")
        stats[f"interview_sources:{','.join(sorted({str(q.get('source', '?')) for q in qs}))}"] += 1
        print(f"  interview {role:<20} {itype:<10} {diff:<6} -> {len(qs)}  e.g. {qs[0]['question'][:70] if qs else '-'}")
    print(f"interview done in {time.time() - t0:.0f}s")

    # ── Aptitude ──
    t0 = time.time()
    cases = [("Quantitative", "Percentages"), ("Quantitative", "Time & Work"), ("Quantitative", "Simple Interest"),
             ("Quantitative", "Probability"), ("Logical Reasoning", "Number Series"), ("Logical Reasoning", "Blood Relations"),
             ("Verbal Ability", "Synonyms & Antonyms"), ("Data Interpretation", "Tables")]
    for category, topic in cases:
        session: list[str] = []
        for diff in ("easy", "medium", "hard"):
            r = svc.generate_aptitude_question(category, topic, diff, session=session)
            tag = f"aptitude {topic}/{diff}"
            expect("error" not in r, f"{tag}: {r.get('error')}")
            if "error" in r:
                continue
            expect(r["topic"] == topic and r["category"] == category, f"{tag}: topic/category not respected ({r['category']}/{r['topic']})")
            expect(len(r["options"]) == 4 and len(set(r["options"])) == 4, f"{tag}: options {r['options']}")
            expect(0 <= r["answer_index"] < 4 and bool(r["explanation"]), f"{tag}: key/explanation missing")
            expect(r["question"] not in session, f"{tag}: duplicate in session")
            if r["source"] in ("model", "template"):
                expect(r["difficulty"] == diff, f"{tag}: generated at {r['difficulty']}")
            if is_numeric_question(r["options"], category, topic) and r["source"] != "bank":
                v = verify_numeric_mcq(r["question"], r["options"], r["answer_index"], r["explanation"], topic)
                expect(v.status == "verified", f"{tag}: served numeric key not verified ({v.status} {v.reasons})")
            stats[f"aptitude_source:{r['source']}/{r['verification']}"] += 1
            session.append(r["question"])
            print(f"  {tag:<40} {r['source']:<8} {r['verification']:<28} {r['question'][:60]}")
    print(f"aptitude done in {time.time() - t0:.0f}s")

    # ── Tech ──
    t0 = time.time()
    type_fields = {"MCQ": ("options", "correct_option"), "Output Prediction": ("code_snippet", "answer"), "Debugging": ("buggy_code", "fixed_code")}
    for tech in ("Python", "Java", "C", "C++", "SQL", "HTML", "CSS", "JavaScript", "React", "Node.js"):
        seen: list[str] = []
        for qtype, diff in (("mcq", "easy"), ("conceptual", "medium"), ("output_prediction", "medium"), ("debugging", "hard"), ("coding", "hard")):
            r = svc.generate_tech_question(tech, "", diff, qtype, session=seen)
            tag = f"tech {tech}/{qtype}"
            expect("error" not in r, f"{tag}: {r.get('error')}")
            if "error" in r:
                continue
            expect(r["technology"] == tech, f"{tag}: technology {r['technology']}")
            for f in type_fields.get(r["question_type"], ("answer",)):
                expect(r.get(f) not in (None, "", []), f"{tag}: missing {f}")
            expect(r["question"] not in seen, f"{tag}: duplicate")
            stats[f"tech_type_match:{r['question_kind'] == qtype}"] += 1
            seen.append(r["question"])
        print(f"  tech {tech:<11} ok ({len(seen)} questions)")
    print(f"tech done in {time.time() - t0:.0f}s")

    print("\nsummary:", json.dumps(dict(stats), indent=1))
    print(f"{stats['checks'] - len(problems)}/{stats['checks']} checks passed")
    for p in problems:
        print("  PROBLEM:", p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
