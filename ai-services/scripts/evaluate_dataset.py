"""
Dataset health report: coverage against targets, and (if the QA classifier
has been trained - see training/train_tech_question_classifier.py) a list of
questions whose declared difficulty/question_type disagrees with the
model's prediction at high confidence, for human review.

    python scripts/evaluate_dataset.py

This does not modify the dataset - it only reports. Nothing here is used at
interview runtime; it is purely an authoring-time QA tool.
"""

import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
AI_SERVICES_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(AI_SERVICES_DIR, "training", "data", "tech_questions")
MODEL_DIR = os.path.join(AI_SERVICES_DIR, "models", "question_classifier")

TECHNOLOGY_TARGETS = {
    "Python": 100, "Java": 100, "SQL": 100, "C++": 100, "C": 100,
    "HTML": 75, "CSS": 75, "JavaScript": 100, "React": 100, "Node.js": 100,
}
TECHNOLOGY_FILES = {
    "Python": "python", "Java": "java", "SQL": "sql", "C++": "cpp", "C": "c",
    "HTML": "html", "CSS": "css", "JavaScript": "javascript", "React": "react", "Node.js": "nodejs",
}

# Only flag a mismatch when the model is this confident, to avoid noisy
# false positives on genuinely borderline questions.
CONFIDENCE_THRESHOLD = 0.75


def load_all_records() -> list:
    records = []
    for technology, file_key in TECHNOLOGY_FILES.items():
        path = os.path.join(DATA_DIR, f"{file_key}.json")
        if os.path.exists(path):
            records.extend(json.load(open(path, "r", encoding="utf-8")))
    return records


def coverage_report(records: list) -> bool:
    print("=== Coverage vs. Target ===")
    counts = {}
    for r in records:
        counts[r["technology"]] = counts.get(r["technology"], 0) + 1

    all_met = True
    for tech, target in TECHNOLOGY_TARGETS.items():
        actual = counts.get(tech, 0)
        met = actual >= target
        all_met = all_met and met
        status = "OK" if met else "SHORT"
        print(f"  {tech:<12} {actual:>4} / {target:<4} target  [{status}]")
    print(f"  {'TOTAL':<12} {sum(counts.values()):>4} / {sum(TECHNOLOGY_TARGETS.values())}")
    print()
    return all_met


def topic_diversity_report(records: list) -> None:
    print("=== Topic Diversity (questions per topic, by technology) ===")
    by_tech_topic = {}
    for r in records:
        key = (r["technology"], r["topic"])
        by_tech_topic[key] = by_tech_topic.get(key, 0) + 1

    by_tech = {}
    for (tech, topic), count in by_tech_topic.items():
        by_tech.setdefault(tech, []).append((topic, count))

    for tech, topics in by_tech.items():
        topics.sort()
        thin = [t for t, c in topics if c < 2]
        print(f"  {tech}: {len(topics)} distinct topics" + (f" (thin: {thin})" if thin else ""))
    print()


def classifier_qa_report(records: list) -> None:
    print("=== Classifier-Based QA (label vs. prediction disagreements) ===")
    try:
        from joblib import load
    except ImportError:
        print("  joblib/scikit-learn not installed - skipping classifier QA.\n")
        return

    vec_path = os.path.join(MODEL_DIR, "vectorizer.joblib")
    if not os.path.exists(vec_path):
        print("  No trained classifier found - run training/train_tech_question_classifier.py first.\n")
        return

    vectorizer = load(vec_path)
    texts = [f"{r.get('question', '')} {' '.join(r.get('keywords', []) or [])}" for r in records]
    X = vectorizer.transform(texts)

    flagged = 0
    for label_field, model_file in [("difficulty", "difficulty_clf.joblib"), ("question_type", "question_type_clf.joblib")]:
        model_path = os.path.join(MODEL_DIR, model_file)
        if not os.path.exists(model_path):
            continue
        clf = load(model_path)
        probs = clf.predict_proba(X)
        classes = clf.classes_
        for i, r in enumerate(records):
            best_idx = probs[i].argmax()
            predicted = classes[best_idx]
            confidence = probs[i][best_idx]
            declared = r.get(label_field)
            if predicted != declared and confidence >= CONFIDENCE_THRESHOLD:
                flagged += 1
                print(
                    f"  [{label_field}] {r.get('id')}: declared='{declared}' "
                    f"model_predicts='{predicted}' (confidence={confidence:.2f}) - {r.get('question', '')[:70]}"
                )

    if flagged == 0:
        print("  No high-confidence disagreements found.")
    print()


def main() -> int:
    records = load_all_records()
    if not records:
        print("No questions found - author the dataset first (see training/data/tech_questions/SCHEMA.md).")
        return 1

    all_targets_met = coverage_report(records)
    topic_diversity_report(records)
    classifier_qa_report(records)

    return 0 if all_targets_met else 1


if __name__ == "__main__":
    sys.exit(main())
