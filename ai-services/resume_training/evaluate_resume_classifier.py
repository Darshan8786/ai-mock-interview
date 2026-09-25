"""
Final evaluation of the trained resume classifier on the held-out TEST split
only. This split was never touched by train_resume_classifier.py (not used
to fit the vectorizer, the model, or to pick between candidates - that
decision was made on the validation split only). Run this once, at the end.

    python -m resume_training.evaluate_resume_classifier
"""

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)

BASE_DIR = Path(__file__).parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"
MODEL_DIR = BASE_DIR / "models" / "resume_classifier"
REPORT_DIR = BASE_DIR / "data" / "reports"


def main():
    test_df = pd.read_csv(PROCESSED_DIR / "test.csv")
    vectorizer = joblib.load(MODEL_DIR / "vectorizer.joblib")
    model = joblib.load(MODEL_DIR / "model.joblib")
    classes = json.loads((MODEL_DIR / "classes.json").read_text(encoding="utf-8"))
    meta = json.loads((MODEL_DIR / "meta.json").read_text(encoding="utf-8"))

    X_test = vectorizer.transform(test_df["Resume_str"].fillna(""))
    y_test = test_df["Category"]
    preds = model.predict(X_test)
    probs = model.predict_proba(X_test)  # calibrated (CalibratedClassifierCV or native LogisticRegression)
    confidences = probs.max(axis=1)

    acc = accuracy_score(y_test, preds)
    macro_p, macro_r, macro_f1, _ = precision_recall_fscore_support(y_test, preds, average="macro", zero_division=0)
    weighted_p, weighted_r, weighted_f1, _ = precision_recall_fscore_support(y_test, preds, average="weighted", zero_division=0)

    print(f"Model: {meta['chosen_model']}")
    print(f"Test set: {len(test_df)} rows, {test_df['Category'].nunique()} classes")
    print(f"\nAccuracy:        {acc:.4f}")
    print(f"Macro precision: {macro_p:.4f}   Macro recall: {macro_r:.4f}   Macro F1: {macro_f1:.4f}")
    print(f"Weighted P:      {weighted_p:.4f}   Weighted R: {weighted_r:.4f}   Weighted F1: {weighted_f1:.4f}")

    report_dict = classification_report(y_test, preds, output_dict=True, zero_division=0)
    print("\nPer-class report (worst 5 by F1, so problems are visible, not buried):")
    per_class = {k: v for k, v in report_dict.items() if k in classes}
    worst = sorted(per_class.items(), key=lambda kv: kv[1]["f1-score"])[:5]
    for cls, m in worst:
        print(f"  {cls:<25} P={m['precision']:.2f} R={m['recall']:.2f} F1={m['f1-score']:.2f} (n={int(m['support'])})")

    cm = confusion_matrix(y_test, preds, labels=classes)
    cm_df = pd.DataFrame(cm, index=classes, columns=classes)
    cm_df.to_csv(REPORT_DIR / "resume_classifier_confusion_matrix.csv")

    print("\n10 real test examples (true vs predicted vs confidence):")
    sample = test_df.sample(min(10, len(test_df)), random_state=7)
    for idx in sample.index:
        pos = test_df.index.get_loc(idx)
        true = test_df.loc[idx, "Category"]
        pred = preds[pos]
        conf = confidences[pos]
        mark = "OK " if true == pred else "MISS"
        print(f"  [{mark}] true={true:<22} pred={pred:<22} conf={conf:.2f}")

    (REPORT_DIR / "resume_classifier_eval.json").write_text(
        json.dumps(
            {
                "model": meta["chosen_model"],
                "test_rows": len(test_df),
                "accuracy": round(float(acc), 4),
                "macro_precision": round(float(macro_p), 4),
                "macro_recall": round(float(macro_r), 4),
                "macro_f1": round(float(macro_f1), 4),
                "weighted_precision": round(float(weighted_p), 4),
                "weighted_recall": round(float(weighted_r), 4),
                "weighted_f1": round(float(weighted_f1), 4),
                "per_class": per_class,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\nSaved metrics to {REPORT_DIR / 'resume_classifier_eval.json'}")
    print(f"Saved confusion matrix to {REPORT_DIR / 'resume_classifier_confusion_matrix.csv'}")


if __name__ == "__main__":
    main()
