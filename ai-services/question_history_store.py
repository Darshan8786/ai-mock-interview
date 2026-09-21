"""
Global, persistent, cross-user question-history store (Rule 5/6 of the
mock-interview spec: a question shown to any user must never be shown again
to any other user - including semantically-equivalent rewordings).

Backed by a local SQLite file (no external DB, no API, works offline). This
is process- and restart-durable: it lives on disk, not in Flask/React state.

Duplicate detection has two layers, both purely local:
  1. Exact match on a normalized (lowercased, punctuation-stripped) form.
  2. Near-duplicate match via difflib.SequenceMatcher ratio + token-set
     Jaccard overlap against previously used questions in the same
     skill/topic bucket - this catches paraphrases such as
     "What is inheritance in Python?" vs "How does Python inheritance work?"
     without needing any embedding model or external service.
"""

import difflib
import os
import re
import sqlite3
import threading
import time

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "question_history.sqlite")

# Tunable similarity thresholds for the local semantic-duplicate heuristic.
SEQUENCE_RATIO_THRESHOLD = 0.85
JACCARD_THRESHOLD = 0.80

_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "what", "how", "why", "do", "does",
    "did", "you", "your", "of", "in", "on", "for", "to", "and", "or", "explain",
    "describe", "tell", "me", "about", "with", "can", "would", "will", "between",
}


def normalize_for_compare(question: str) -> str:
    q = question.strip().lower()
    q = re.sub(r"[^a-z0-9\s]", "", q)
    return " ".join(q.split())


def _token_set(question: str) -> set:
    return {w for w in normalize_for_compare(question).split() if w not in _STOPWORDS}


class QuestionHistoryStore:
    """Thread-safe singleton wrapping a SQLite table of every question ever
    shown to any user, across process restarts."""

    _instance = None
    _instance_lock = threading.Lock()

    def __new__(cls):
        with cls._instance_lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._init_db()
            return cls._instance

    def _init_db(self):
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS used_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_text TEXT NOT NULL,
                normalized_question TEXT NOT NULL,
                skill TEXT,
                topic TEXT,
                interview_type TEXT,
                difficulty TEXT,
                experience_level TEXT,
                job_role TEXT,
                user_id TEXT,
                session_id TEXT,
                source TEXT,
                created_at REAL NOT NULL
            )
            """
        )
        self._conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_norm ON used_questions(normalized_question)"
        )
        self._conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_bucket ON used_questions(skill, topic)"
        )
        self._conn.commit()

    def _candidates_in_bucket(self, skill: str, topic: str) -> list:
        cur = self._conn.execute(
            "SELECT normalized_question FROM used_questions WHERE skill = ? AND topic = ?",
            (skill or "", topic or ""),
        )
        return [row[0] for row in cur.fetchall()]

    def is_duplicate(self, question: str, skill: str = "", topic: str = "") -> bool:
        """True if this question (or a near-paraphrase of it) has already
        been shown to ANY user, ever."""
        norm = normalize_for_compare(question)
        if not norm:
            return True  # empty/garbage candidate is never usable

        with self._lock:
            # Exact global match, regardless of bucket (a question about the
            # same skill/topic asked under a slightly different label should
            # still be caught).
            cur = self._conn.execute(
                "SELECT 1 FROM used_questions WHERE normalized_question = ? LIMIT 1", (norm,)
            )
            if cur.fetchone() is not None:
                return True

            # Near-duplicate check, scoped to the same skill+topic bucket to
            # keep this O(bucket size) instead of O(all questions ever asked).
            bucket = self._candidates_in_bucket(skill, topic)

        if not bucket:
            return False

        candidate_tokens = _token_set(question)
        for existing_norm in bucket:
            ratio = difflib.SequenceMatcher(None, norm, existing_norm).ratio()
            if ratio >= SEQUENCE_RATIO_THRESHOLD:
                return True

            existing_tokens = {w for w in existing_norm.split() if w not in _STOPWORDS}
            if candidate_tokens and existing_tokens:
                union = candidate_tokens | existing_tokens
                jaccard = len(candidate_tokens & existing_tokens) / len(union) if union else 0
                if jaccard >= JACCARD_THRESHOLD:
                    return True

        return False

    def mark_used(
        self,
        question: str,
        skill: str = "",
        topic: str = "",
        interview_type: str = "",
        difficulty: str = "",
        experience_level: str = "",
        job_role: str = "",
        user_id: str = "",
        session_id: str = "",
        source: str = "",
    ) -> None:
        norm = normalize_for_compare(question)
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO used_questions
                (question_text, normalized_question, skill, topic, interview_type,
                 difficulty, experience_level, job_role, user_id, session_id, source, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    question, norm, skill or "", topic or "", interview_type or "",
                    difficulty or "", experience_level or "", job_role or "",
                    user_id or "", session_id or "", source or "", time.time(),
                ),
            )
            self._conn.commit()

    def usage_count(self) -> int:
        with self._lock:
            cur = self._conn.execute("SELECT COUNT(*) FROM used_questions")
            return cur.fetchone()[0]


_default_store = None
_default_lock = threading.Lock()


def get_store() -> QuestionHistoryStore:
    global _default_store
    if _default_store is None:
        with _default_lock:
            if _default_store is None:
                _default_store = QuestionHistoryStore()
    return _default_store
