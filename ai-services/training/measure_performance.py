#!/usr/bin/env python
"""
Phase 11 - Performance measurement for the local interview-question generator.

Run in a fresh process (so "load time" is measured honestly, not warmed up by
anything else already having imported the model in this interpreter).

Usage (run from ai-services/):
    python training/measure_performance.py
"""

import json
import os
import statistics
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")

try:
    import psutil
    _process = psutil.Process(os.getpid())
except ImportError:
    psutil = None
    _process = None

import torch  # noqa: E402
from local_question_generator import LocalQuestionGenerator  # noqa: E402

SAMPLE_CASES = [
    ("Python", "Functions", "Easy"),
    ("Python", "OOP", "Medium"),
    ("SQL", "Joins", "Medium"),
    ("Java", "Collections", "Medium"),
    ("Data Structures", "Trees", "Hard"),
    ("Machine Learning", "Common Algorithms", "Medium"),
    ("DBMS", "Normalization", "Easy"),
    ("Computer Networks", "TCP vs UDP", "Medium"),
    ("Operating Systems", "Deadlocks", "Hard"),
    ("Web Development", "REST APIs", "Medium"),
]


def rss_mb() -> float | None:
    if _process is None:
        return None
    return round(_process.memory_info().rss / (1024 * 1024), 1)


def main():
    report = {"cuda_available": torch.cuda.is_available()}

    mem_before_load = rss_mb()
    generator = LocalQuestionGenerator()

    load_start = time.time()
    generator._ensure_loaded()
    load_time_ms = round((time.time() - load_start) * 1000, 1)
    mem_after_load = rss_mb()

    report["model_loading"] = {
        "load_time_ms": load_time_ms,
        "reported_load_time_ms": generator.last_load_time_ms,
        "load_error": generator._load_error,
        "rss_mb_before": mem_before_load,
        "rss_mb_after": mem_after_load,
    }

    if torch.cuda.is_available():
        report["gpu"] = {
            "device_name": torch.cuda.get_device_name(0),
            "memory_allocated_mb": round(torch.cuda.memory_allocated(0) / (1024 * 1024), 1),
            "memory_reserved_mb": round(torch.cuda.memory_reserved(0) / (1024 * 1024), 1),
        }
    else:
        report["gpu"] = {"note": "CUDA not available - this run used CPU only"}

    latencies = []
    for skill, topic, difficulty in SAMPLE_CASES:
        result = generator.generate_question(skill=skill, topic=topic, difficulty=difficulty, candidate_level="Fresher")
        latencies.append(result["generation_time_ms"])

    report["generation_latency_ms"] = {
        "samples": len(latencies),
        "min": round(min(latencies), 1),
        "max": round(max(latencies), 1),
        "mean": round(statistics.mean(latencies), 1),
        "median": round(statistics.median(latencies), 1),
    }
    report["rss_mb_after_generation"] = rss_mb()
    report["note"] = (
        "The model is loaded ONCE per process (LocalQuestionGenerator is a singleton) and "
        "reused for every subsequent question - these per-question latencies do not include "
        "reload cost. The Flask ai-service additionally warms the model in a background "
        "thread at process startup, so the first real interview request also avoids the "
        "load cost where possible."
    )

    os.makedirs(config.EVAL_RESULTS_DIR, exist_ok=True)
    out_path = os.path.join(config.EVAL_RESULTS_DIR, "performance_report.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(json.dumps(report, indent=2))
    print(f"\nSaved: {out_path}")


if __name__ == "__main__":
    main()
