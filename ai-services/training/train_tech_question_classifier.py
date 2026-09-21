"""
Trains a genuine, small, local scikit-learn model on the tech-question
dataset - NOT used to select or answer interview questions at runtime (that
is a deterministic, inspectable retrieval engine - see tech_question_engine.py
and TRAINING DATASET / QUESTION INDEX / QUESTION SELECTION ENGINE separation
described in the dataset's SCHEMA.md). This model's only job is dataset
quality assurance: given a question's text, predict its difficulty and
question_type, then flag records where the author's declared label disagrees
with the model - a real signal that a question may be mislabeled, used by
scripts/evaluate_dataset.py.

Two classifiers share one TF-IDF vectorizer (question text + keywords):
  - difficulty_clf: Easy / Medium / Hard
  - question_type_clf: the 9 question_type values

Saved with joblib to ai-services/models/question_classifier/ and loaded by
evaluate_dataset.py. Offline, no external API - runs entirely on the local
dataset already on disk.

    python training/train_tech_question_classifier.py
"""

import json
import os
import sys

from joblib import dump
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

TRAINING_DIR = os.path.dirname(os.path.abspath(__file__))
AI_SERVICES_DIR = os.path.dirname(TRAINING_DIR)
DATA_DIR = os.path.join(TRAINING_DIR, "data", "tech_questions")
MODEL_DIR = os.path.join(AI_SERVICES_DIR, "models", "question_classifier")

TECHNOLOGY_FILES = ["python", "java", "sql", "cpp", "c", "html", "css", "javascript", "react", "nodejs"]

SEED = 42
MIN_RECORDS_FOR_SPLIT = 40  # below this, skip the held-out eval and just report training fit


def load_all_records() -> list:
    records = []
    for file_key in TECHNOLOGY_FILES:
        path = os.path.join(DATA_DIR, f"{file_key}.json")
        if not os.path.exists(path):
            continue
        records.extend(json.load(open(path, "r", encoding="utf-8")))
    return records


def text_for(record: dict) -> str:
    keywords = " ".join(record.get("keywords", []) or [])
    return f"{record.get('question', '')} {keywords}"


def train_one(name: str, X_text: list, y: list, vectorizer: TfidfVectorizer):
    X = vectorizer.transform(X_text)
    if len(set(y)) < 2:
        print(f"  [{name}] only one class present ({set(y)}) - skipping, not a meaningful classifier")
        return None

    if len(y) >= MIN_RECORDS_FOR_SPLIT:
        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=0.2, random_state=SEED, stratify=y
        )
    else:
        X_train, y_train = X, y
        X_val, y_val = X, y

    clf = LogisticRegression(max_iter=1000, class_weight="balanced")
    clf.fit(X_train, y_train)
    preds = clf.predict(X_val)
    acc = accuracy_score(y_val, preds)
    print(f"  [{name}] validation accuracy: {acc:.3f} (n_train={X_train.shape[0]}, n_val={X_val.shape[0]})")
    print(classification_report(y_val, preds, zero_division=0))
    return clf


def main() -> int:
    records = load_all_records()
    if len(records) < 10:
        print(f"Only {len(records)} questions found in {DATA_DIR} - author the dataset first.")
        return 1

    texts = [text_for(r) for r in records]
    difficulties = [r["difficulty"] for r in records]
    question_types = [r["question_type"] for r in records]

    print(f"Training on {len(records)} questions across {len(TECHNOLOGY_FILES)} technology files.\n")

    vectorizer = TfidfVectorizer(
        lowercase=True,
        stop_words="english",
        ngram_range=(1, 2),
        min_df=2,
        max_features=20000,
    )
    vectorizer.fit(texts)

    print("Training difficulty_clf ...")
    difficulty_clf = train_one("difficulty_clf", texts, difficulties, vectorizer)

    print("\nTraining question_type_clf ...")
    question_type_clf = train_one("question_type_clf", texts, question_types, vectorizer)

    os.makedirs(MODEL_DIR, exist_ok=True)
    dump(vectorizer, os.path.join(MODEL_DIR, "vectorizer.joblib"))
    if difficulty_clf is not None:
        dump(difficulty_clf, os.path.join(MODEL_DIR, "difficulty_clf.joblib"))
    if question_type_clf is not None:
        dump(question_type_clf, os.path.join(MODEL_DIR, "question_type_clf.joblib"))

    with open(os.path.join(MODEL_DIR, "MODEL_CARD.md"), "w", encoding="utf-8") as f:
        f.write(
            "# Tech-Question Dataset QA Classifier\n\n"
            f"Trained on {len(records)} questions from the local tech_questions dataset.\n\n"
            "- `vectorizer.joblib`: TF-IDF over question text + keywords (1-2 grams).\n"
            "- `difficulty_clf.joblib`: LogisticRegression predicting Easy/Medium/Hard.\n"
            "- `question_type_clf.joblib`: LogisticRegression predicting the 9 question types.\n\n"
            "Purpose: dataset QA only (scripts/evaluate_dataset.py flags label/prediction "
            "disagreements for human review). This model does NOT select interview questions "
            "or grade answers at runtime - see tech_question_engine.py for the deterministic "
            "selection engine and tech_answer_evaluator.py for grading.\n"
        )

    print(f"\nSaved model artifacts to {MODEL_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
