"""Shared helpers for the interviewer-LLM pipeline (paths, text normalisation, similarity, taxonomy)."""
from __future__ import annotations

import hashlib
import json
import re
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # ai-services/interviewer_llm
PROCESSED = ROOT / "data" / "processed"
REPORTS = ROOT / "data" / "reports"
PATH_FILE = ROOT / "data" / "dataset_path.txt"
CURATED_DEFAULT = ROOT.parent / "training" / "data" / "interview_questions" / "raw_dataset.json"

DIFFICULTIES = ("Easy", "Medium", "Hard")

# Kaggle "Category" -> (canonical topic, subtopic). Unknown labels fall back to themselves.
KAGGLE_TOPIC_MAP = {
    "general programming": ("General Programming", ""),
    "general program": ("General Programming", ""),          # typo variant in the source data
    "languages and frameworks": ("Programming Languages", ""),
    "data structures": ("Data Structures", ""),
    "algorithms": ("Algorithms", ""),
    "database and sql": ("SQL", ""),
    "database systems": ("DBMS", ""),
    "networking": ("Computer Networks", ""),
    "low-level systems": ("Operating Systems", "Low-level systems"),
    "software testing": ("Software Testing", ""),
    "version control": ("Version Control", ""),
    "devops": ("DevOps", ""),
    "security": ("Security", ""),
    "system design": ("System Design", ""),
    "distributed systems": ("System Design", "Distributed systems"),
    "web development": ("Web Development", ""),
    "front-end": ("Web Development", "Front-end"),
    "back-end": ("Web Development", "Back-end"),
    "full-stack": ("Web Development", "Full-stack"),
    "machine learning": ("Machine Learning", ""),
    "artificial intelligence": ("Artificial Intelligence", ""),
    "data engineering": ("Data Engineering", ""),
}

# Roles a question of a given topic is plausibly asked for (used to build role-conditioned prompts).
# The source data has no role column, so this is a documented heuristic, not ground truth.
ROLE_MAP = {
    "Python": ["Python Developer", "Backend Developer", "Software Engineer"],
    "Java": ["Java Developer", "Backend Developer", "Software Engineer"],
    "C": ["C Developer", "Embedded Software Engineer", "Software Engineer"],
    "C++": ["C++ Developer", "Systems Engineer", "Software Engineer"],
    "JavaScript": ["Frontend Developer", "Full Stack Developer", "Software Engineer"],
    "SQL": ["Backend Developer", "Database Engineer", "Software Engineer"],
    "DBMS": ["Backend Developer", "Database Engineer", "Software Engineer"],
    "OOP": ["Software Engineer", "Java Developer", "Backend Developer"],
    "Data Structures": ["Software Engineer", "Backend Developer"],
    "Algorithms": ["Software Engineer", "Backend Developer"],
    "Computer Networks": ["Network Engineer", "Software Engineer", "DevOps Engineer"],
    "Operating Systems": ["Software Engineer", "Systems Engineer"],
    "Machine Learning": ["Machine Learning Engineer", "Data Scientist", "Software Engineer"],
    "Artificial Intelligence": ["Machine Learning Engineer", "Data Scientist", "Software Engineer"],
    "Web Development": ["Web Developer", "Full Stack Developer", "Software Engineer"],
    "General Programming": ["Software Engineer", "Backend Developer"],
    "Programming Languages": ["Software Engineer", "Backend Developer"],
    "Software Testing": ["QA Engineer", "Software Engineer"],
    "Version Control": ["Software Engineer", "DevOps Engineer"],
    "DevOps": ["DevOps Engineer", "Software Engineer"],
    "Security": ["Security Engineer", "Software Engineer"],
    "System Design": ["Software Engineer", "Backend Developer", "Solutions Architect"],
    "Data Engineering": ["Data Engineer", "Backend Developer"],
}
SUBTOPIC_ROLE = {"Front-end": "Frontend Developer", "Back-end": "Backend Developer", "Full-stack": "Full Stack Developer"}


def norm(text: str) -> str:
    """Lower-case, punctuation-free, single-spaced: the key used for duplicate detection."""
    return " ".join(re.sub(r"[^a-z0-9\s]", " ", str(text).lower()).split())


def tokens(text: str) -> set[str]:
    return set(norm(text).split())


def similar(a: str, b: str, threshold: float = 0.85) -> bool:
    """Near-duplicate test on normalised text (cheap Jaccard gate, then edit-distance ratio)."""
    na, nb = norm(a), norm(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    if abs(len(na) - len(nb)) > 0.4 * max(len(na), len(nb)):
        return False
    ta, tb = set(na.split()), set(nb.split())
    if len(ta & tb) / max(len(ta | tb), 1) < 0.6:
        return False
    return SequenceMatcher(None, na, nb).ratio() >= threshold


def clean_text(text: str) -> str:
    text = str(text).replace(" ", " ")
    text = text.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return " ".join(text.split())


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def stable_int(key: str) -> int:
    """Deterministic pseudo-random integer from a string (same every run / machine)."""
    return int(hashlib.md5(key.encode("utf-8")).hexdigest()[:8], 16)
