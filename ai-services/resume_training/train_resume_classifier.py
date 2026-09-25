"""
Trains a local resume -> job-category classifier on snehaanbhawal/resume-dataset.

This is classical ML (TF-IDF + linear classifier) on ~2000 training rows
across 24 classes, not a generative LLM fine-tune: the dataset-usage
investigation (data/reports/dataset_usage_report.md) found this is the right
tool for this task and hardware, so this script is intentionally proportionate
to the task (no LoRA/epoch/GPU knobs) rather than a copy of the LLM training
harness used elsewhere in this repo (ai-services/interviewer_llm/).

Compares Logistic Regression and Linear SVM (both class_weight="balanced" for
the 22-118-per-class imbalance) on the held-out VALIDATION split only, keeps
whichever wins, and saves it. The TEST split is never touched here - only
evaluate_resume_classifier.py reads it, once.

    python -m resume_training.train_resume_classifier
"""

import json
import os
from pathlib import Path

import joblib
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
from sklearn.svm import LinearSVC

BASE_DIR = Path(__file__).parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"
MODEL_DIR = BASE_DIR / "models" / "resume_classifier"


def main():
    train_df = pd.read_csv(PROCESSED_DIR / "train.csv")
    val_df = pd.read_csv(PROCESSED_DIR / "val.csv")
    print(f"train: {len(train_df)} rows, {train_df['Category'].nunique()} classes")
    print(f"val:   {len(val_df)} rows, {val_df['Category'].nunique()} classes")

    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.9,
        sublinear_tf=True,
        max_features=50000,
    )
    X_train = vectorizer.fit_transform(train_df["Resume_str"].fillna(""))
    X_val = vectorizer.transform(val_df["Resume_str"].fillna(""))
    y_train = train_df["Category"]
    y_val = val_df["Category"]

    # LinearSVC has no predict_proba; wrap it with CalibratedClassifierCV so
    # both candidates expose genuinely calibrated probabilities (needed for an
    # honest `confidence` value in the inference API - raw SVM decision-
    # function margins pushed through an ad-hoc softmax were checked and are
    # NOT well-calibrated: they came out ~0.05-0.12 across the board, barely
    # above the 24-class uniform baseline of ~0.04, even for correct
    # predictions). cv=3 (not the default 5) because the smallest class has
    # only ~17-18 training examples after the 80/10/10 split.
    candidates = {
        "logistic_regression": LogisticRegression(
            max_iter=2000, class_weight="balanced", C=1.0, random_state=42
        ),
        "linear_svm": CalibratedClassifierCV(
            LinearSVC(class_weight="balanced", C=1.0, random_state=42), cv=3
        ),
    }

    results = {}
    for name, clf in candidates.items():
        clf.fit(X_train, y_train)
        preds = clf.predict(X_val)
        macro_f1 = f1_score(y_val, preds, average="macro", zero_division=0)
        acc = (preds == y_val).mean()
        results[name] = {"macro_f1": round(float(macro_f1), 4), "accuracy": round(float(acc), 4)}
        print(f"  {name}: val accuracy={acc:.4f}  val macro-F1={macro_f1:.4f}")

    winner = max(results, key=lambda k: results[k]["macro_f1"])
    print(f"\nWinner (by validation macro-F1): {winner} ({results[winner]})")

    best_clf = candidates[winner]

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(vectorizer, MODEL_DIR / "vectorizer.joblib")
    joblib.dump(best_clf, MODEL_DIR / "model.joblib")
    classes = sorted(y_train.unique().tolist())
    (MODEL_DIR / "classes.json").write_text(json.dumps(classes, indent=2), encoding="utf-8")
    (MODEL_DIR / "meta.json").write_text(
        json.dumps(
            {
                "chosen_model": winner,
                "validation_results": results,
                "train_rows": len(train_df),
                "val_rows": len(val_df),
                "n_classes": len(classes),
                "vectorizer": {
                    "ngram_range": [1, 2],
                    "min_df": 2,
                    "max_df": 0.9,
                    "max_features": 50000,
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\nSaved {winner} + vectorizer + classes to {MODEL_DIR}")


if __name__ == "__main__":
    main()
