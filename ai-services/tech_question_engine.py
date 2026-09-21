"""
Local, deterministic question SELECTION ENGINE for the trained tech-question
system (Python / Java / SQL / C++ / C / HTML / CSS / JavaScript / React /
Node.js). This is intentionally NOT a machine-learning model - it is an
inspectable retrieval engine over the local, human-authored, validated
dataset built by the scripts/ pipeline (see
training/data/tech_questions/SCHEMA.md and scripts/build_question_index.py).

Separation of concerns (per the project's requirement to not conflate a
static dataset with "training"):
  TRAINING DATASET   -> training/data/tech_questions/*.json (authored, validated)
  QUESTION INDEX     -> training/data/tech_questions/_index.json (built artifact)
  SELECTION ENGINE   -> this file (deterministic filtering/sampling logic)
  QA CLASSIFIER      -> training/train_tech_question_classifier.py + models/question_classifier/
                        (a genuine trained scikit-learn model, used only for
                        dataset QA - see scripts/evaluate_dataset.py - never
                        for runtime question selection or answer grading)

No external API is used anywhere in this module.
"""

import json
import os
import random
import threading

AI_SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(AI_SERVICES_DIR, "training", "data", "tech_questions")
INDEX_PATH = os.path.join(DATA_DIR, "_index.json")
META_PATH = os.path.join(DATA_DIR, "_technologies_meta.json")

DIFFICULTIES = ["Easy", "Medium", "Hard"]
# Default blend used when the caller asks for "Mixed" difficulty - a rough
# progressive-interview shape (mostly foundational, tapering into harder
# questions) rather than a flat 1/3-1/3-1/3 split.
MIXED_DIFFICULTY_WEIGHTS = {"Easy": 0.4, "Medium": 0.4, "Hard": 0.2}

# Fields never sent to the client before they answer - the correct answer
# must only ever be revealed by the server-side evaluator, after grading.
_PRIVATE_FIELDS = {"answer", "explanation", "correct_option", "expected_solution", "fixed_code"}


class TechQuestionEngine:
    _instance = None
    _instance_lock = threading.Lock()

    def __new__(cls):
        with cls._instance_lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._load()
            return cls._instance

    def _load(self):
        self._by_id = {}
        self._by_technology = {}
        self._meta = {}
        self._load_error = None

        try:
            with open(INDEX_PATH, "r", encoding="utf-8") as f:
                index = json.load(f)
            for record in index.get("questions", []):
                self._by_id[record["id"]] = record
                self._by_technology.setdefault(record["technology"], []).append(record)
        except FileNotFoundError:
            self._load_error = (
                f"No question index found at {INDEX_PATH}. Run "
                "scripts/prepare_dataset.py then scripts/build_question_index.py."
            )
        except Exception as e:  # noqa: BLE001
            self._load_error = f"Failed to load question index: {e}"

        try:
            with open(META_PATH, "r", encoding="utf-8") as f:
                self._meta = json.load(f)
        except Exception:  # noqa: BLE001
            self._meta = {}

    def reload(self):
        """Re-reads the index from disk - call after re-running the pipeline
        without restarting the process."""
        self._load()

    @property
    def is_loaded(self) -> bool:
        return self._load_error is None and bool(self._by_id)

    @property
    def load_error(self):
        return self._load_error

    def list_technologies(self) -> dict:
        return self._meta

    def get_full_question(self, question_id: str):
        """Full record INCLUDING the correct answer - server-side evaluation only."""
        return self._by_id.get(question_id)

    @staticmethod
    def to_public(record: dict) -> dict:
        """Strips every answer-revealing field. Safe to send to the client
        before they've submitted an answer."""
        public = {k: v for k, v in record.items() if k not in _PRIVATE_FIELDS}
        if "test_cases" in public:
            # Keep the input shape visible (so the candidate knows the
            # expected call signature) but never the expected output.
            public["test_cases"] = [{"input": tc.get("input", "")} for tc in public["test_cases"]]
        return public

    def _difficulty_plan(self, difficulty: str, count: int) -> dict:
        """Returns {difficulty: how_many} for this request."""
        if difficulty in DIFFICULTIES:
            return {difficulty: count}

        # "Mixed" (or anything unrecognized): blend using MIXED_DIFFICULTY_WEIGHTS,
        # rounding so the parts always sum to `count`.
        raw = {d: count * w for d, w in MIXED_DIFFICULTY_WEIGHTS.items()}
        plan = {d: int(v) for d, v in raw.items()}
        remainder = count - sum(plan.values())
        # Hand out leftover slots to the difficulties with the largest
        # fractional remainder first (largest-remainder rounding).
        fractional_order = sorted(raw, key=lambda d: raw[d] - plan[d], reverse=True)
        for d in fractional_order[:remainder]:
            plan[d] += 1
        return plan

    def select_questions(
        self,
        technology: str,
        difficulty: str = "Mixed",
        count: int = 10,
        question_types: list | None = None,
        exclude_ids: list | None = None,
        topic_weights: dict | None = None,
    ) -> dict:
        """Selects up to `count` questions for `technology`.

        No duplicates (sampling without replacement), topic diversity
        (round-robins across topics rather than pure random so one topic
        can't dominate a short quiz), and appropriate difficulty. When
        `topic_weights` is given (e.g. {"OOP": 3.0} for a topic the user has
        struggled with), those topics are drawn from first/more often -
        this is the adaptive hook the Node backend's performance-tracking
        layer calls into.

        Returns {"questions": [...public records...], "requested": count,
        "insufficient": bool} - "insufficient" means the dataset/filters
        couldn't produce enough distinct questions, so the caller should
        never silently pad with repeats.
        """
        pool = self._by_technology.get(technology, [])
        exclude = set(exclude_ids or [])
        pool = [r for r in pool if r["id"] not in exclude]
        if question_types:
            wanted = set(question_types)
            pool = [r for r in pool if r["question_type"] in wanted]

        plan = self._difficulty_plan(difficulty, count)
        selected: list = []

        for target_difficulty, need in plan.items():
            if need <= 0:
                continue
            candidates = [r for r in pool if r["difficulty"] == target_difficulty and r["id"] not in {s["id"] for s in selected}]
            picked = self._pick_topic_diverse(candidates, need, topic_weights)
            selected.extend(picked)

        # Backfill from any difficulty if the requested split came up short
        # (e.g. a niche technology/topic combo doesn't have enough Hard
        # questions yet) - never repeats an id already selected.
        if len(selected) < count:
            remaining_pool = [r for r in pool if r["id"] not in {s["id"] for s in selected}]
            backfill = self._pick_topic_diverse(remaining_pool, count - len(selected), topic_weights)
            selected.extend(backfill)

        random.shuffle(selected)
        return {
            "questions": [self.to_public(r) for r in selected],
            "requested": count,
            "insufficient": len(selected) < count,
        }

    @staticmethod
    def _pick_topic_diverse(candidates: list, need: int, topic_weights: dict | None) -> list:
        if need <= 0 or not candidates:
            return []

        by_topic: dict = {}
        for r in candidates:
            by_topic.setdefault(r["topic"], []).append(r)
        for bucket in by_topic.values():
            random.shuffle(bucket)

        # Topics get repeated in this cycle order proportional to their
        # weight (default 1.0) - a weight of 3.0 means that topic gets
        # roughly 3x as many draw turns as an unweighted topic, without
        # ever exceeding how many questions actually exist for it.
        weights = topic_weights or {}
        cycle: list = []
        for topic in by_topic:
            reps = max(1, round(weights.get(topic, 1.0)))
            cycle.extend([topic] * reps)
        random.shuffle(cycle)

        picked = []
        cycle_idx = 0
        guard = 0
        while len(picked) < need and guard < need * 50 + 100:
            guard += 1
            if not cycle:
                break
            topic = cycle[cycle_idx % len(cycle)]
            cycle_idx += 1
            bucket = by_topic.get(topic)
            if bucket:
                picked.append(bucket.pop())
            if all(not b for b in by_topic.values()):
                break

        return picked


_default_engine = None
_default_lock = threading.Lock()


def get_engine() -> TechQuestionEngine:
    global _default_engine
    if _default_engine is None:
        with _default_lock:
            if _default_engine is None:
                _default_engine = TechQuestionEngine()
    return _default_engine
