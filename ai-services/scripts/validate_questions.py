"""
Validates every technology's local question-dataset file against the schema
in ai-services/training/data/tech_questions/SCHEMA.md.

This is a pure, local, offline QA gate: the application must never load a
question file that fails this check. Run standalone:

    python scripts/validate_questions.py

Exits non-zero (and prints every problem found) if any file fails.
"""

import json
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
AI_SERVICES_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(AI_SERVICES_DIR, "training", "data", "tech_questions")

TECHNOLOGIES = {
    "python": "Python",
    "java": "Java",
    "sql": "SQL",
    "cpp": "C++",
    "c": "C",
    "html": "HTML",
    "css": "CSS",
    "javascript": "JavaScript",
    "react": "React",
    "nodejs": "Node.js",
}

VALID_DIFFICULTIES = {"Easy", "Medium", "Hard"}
VALID_QUESTION_TYPES = {
    "MCQ", "Technical", "Conceptual", "Coding", "Output Prediction",
    "Debugging", "Scenario Based", "SQL Query", "Programming Problem",
}
ID_RE = re.compile(r"^[a-z0-9]+_\d{3,}$")

REQUIRED_BASE_FIELDS = ["id", "technology", "topic", "difficulty", "question", "answer", "explanation", "question_type", "keywords"]


def _norm_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def validate_file(file_key: str, technology: str) -> list:
    """Returns a list of human-readable problem strings (empty = file is clean)."""
    path = os.path.join(DATA_DIR, f"{file_key}.json")
    problems = []

    if not os.path.exists(path):
        return [f"{file_key}.json: file does not exist"]

    with open(path, "r", encoding="utf-8") as f:
        raw = f.read()
    try:
        records = json.loads(raw)
    except json.JSONDecodeError as e:
        return [f"{file_key}.json: invalid JSON - {e}"]

    if not isinstance(records, list):
        return [f"{file_key}.json: top-level JSON must be an array"]

    seen_ids = set()
    seen_question_norms = set()

    for i, r in enumerate(records):
        loc = f"{file_key}.json[{i}]"
        if not isinstance(r, dict):
            problems.append(f"{loc}: record is not an object")
            continue

        for field in REQUIRED_BASE_FIELDS:
            if field not in r or r[field] in (None, "", []):
                problems.append(f"{loc} (id={r.get('id', '?')}): missing/empty required field '{field}'")

        rid = r.get("id", "")
        if rid:
            if not ID_RE.match(rid):
                problems.append(f"{loc}: id '{rid}' does not match '{{tech}}_{{3+ digits}}' pattern")
            if not rid.startswith(f"{file_key}_"):
                problems.append(f"{loc}: id '{rid}' does not start with '{file_key}_'")
            if rid in seen_ids:
                problems.append(f"{loc}: duplicate id '{rid}' within {file_key}.json")
            seen_ids.add(rid)

        if r.get("technology") != technology:
            problems.append(f"{loc} (id={rid}): technology is '{r.get('technology')}', expected '{technology}'")

        difficulty = r.get("difficulty")
        if difficulty is not None and difficulty not in VALID_DIFFICULTIES:
            problems.append(f"{loc} (id={rid}): invalid difficulty '{difficulty}'")

        qtype = r.get("question_type")
        if qtype is not None and qtype not in VALID_QUESTION_TYPES:
            problems.append(f"{loc} (id={rid}): invalid question_type '{qtype}'")
        if qtype == "SQL Query" and technology != "SQL":
            problems.append(f"{loc} (id={rid}): question_type 'SQL Query' only valid for technology 'SQL'")

        keywords = r.get("keywords")
        if keywords is not None and not (isinstance(keywords, list) and all(isinstance(k, str) for k in keywords)):
            problems.append(f"{loc} (id={rid}): keywords must be a list of strings")

        question_text = r.get("question", "")
        norm_q = _norm_text(question_text)
        if norm_q:
            if norm_q in seen_question_norms:
                problems.append(f"{loc} (id={rid}): duplicate question text within {file_key}.json")
            seen_question_norms.add(norm_q)

        if qtype == "MCQ":
            options = r.get("options")
            correct = r.get("correct_option")
            if not (isinstance(options, list) and len(options) == 4 and all(isinstance(o, str) and o.strip() for o in options)):
                problems.append(f"{loc} (id={rid}): MCQ must have exactly 4 non-empty string options")
            if not isinstance(correct, int) or not (isinstance(options, list) and 0 <= correct < len(options)):
                problems.append(f"{loc} (id={rid}): MCQ correct_option must be a valid 0-based index into options")

        if qtype in ("Coding", "Programming Problem"):
            if not r.get("starter_code"):
                problems.append(f"{loc} (id={rid}): {qtype} missing starter_code")
            if not r.get("expected_solution"):
                problems.append(f"{loc} (id={rid}): {qtype} missing expected_solution")
            test_cases = r.get("test_cases")
            if not (isinstance(test_cases, list) and len(test_cases) >= 2):
                problems.append(f"{loc} (id={rid}): {qtype} needs at least 2 test_cases")
            else:
                for j, tc in enumerate(test_cases):
                    if not (isinstance(tc, dict) and "input" in tc and "expected_output" in tc):
                        problems.append(f"{loc} (id={rid}): test_cases[{j}] missing input/expected_output")

        if qtype == "Output Prediction" and not r.get("code_snippet"):
            problems.append(f"{loc} (id={rid}): Output Prediction missing code_snippet")

        if qtype == "Debugging":
            if not r.get("buggy_code"):
                problems.append(f"{loc} (id={rid}): Debugging missing buggy_code")
            if not r.get("fixed_code"):
                problems.append(f"{loc} (id={rid}): Debugging missing fixed_code")

        if qtype == "SQL Query" and not r.get("schema_context"):
            problems.append(f"{loc} (id={rid}): SQL Query missing schema_context")

    return problems


def main() -> int:
    all_problems = []
    all_ids = {}
    total_by_tech = {}

    for file_key, technology in TECHNOLOGIES.items():
        problems = validate_file(file_key, technology)
        all_problems.extend(problems)

        path = os.path.join(DATA_DIR, f"{file_key}.json")
        if os.path.exists(path):
            try:
                records = json.load(open(path, "r", encoding="utf-8"))
                total_by_tech[technology] = len(records) if isinstance(records, list) else 0
                if isinstance(records, list):
                    for r in records:
                        if isinstance(r, dict) and r.get("id"):
                            if r["id"] in all_ids:
                                all_problems.append(
                                    f"GLOBAL: id '{r['id']}' duplicated across {all_ids[r['id']]} and {file_key}.json"
                                )
                            all_ids[r["id"]] = file_key
            except Exception:
                total_by_tech[technology] = 0

    print("=== Tech Question Dataset Validation ===")
    for tech, count in total_by_tech.items():
        print(f"  {tech:<12} {count} questions")
    print(f"  TOTAL: {sum(total_by_tech.values())}")
    print()

    if all_problems:
        print(f"FAILED - {len(all_problems)} problem(s) found:\n")
        for p in all_problems:
            print(f"  - {p}")
        return 1

    print("PASSED - all files are schema-valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
