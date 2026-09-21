#!/usr/bin/env python
"""
Phase 5 - Command-line inference for the local interview-question generator.

Loads the fine-tuned model from models/interview-question-generator/ (no API
key, fully offline) and generates a single interview question for the given
skill/topic/difficulty/level.

Usage (run from ai-services/):
    python inference/generate_question.py --skill Python --topic Functions --difficulty Medium --level Fresher
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "training"))

from local_question_generator import LocalQuestionGenerator  # noqa: E402


def parse_args():
    p = argparse.ArgumentParser(description="Generate one local interview question.")
    p.add_argument("--skill", required=True, help="e.g. Python, Java, SQL, DBMS, Machine Learning")
    p.add_argument("--topic", required=True, help="e.g. Functions, Joins, Normalization")
    p.add_argument("--difficulty", default="Medium", choices=["Easy", "Medium", "Hard"])
    p.add_argument("--level", default="Fresher", choices=["Fresher", "Intermediate", "Experienced"],
                    help="Candidate experience level")
    p.add_argument("--resume-skills", default="", help="Optional comma-separated resume skills (for logging/context)")
    p.add_argument("--verbose", action="store_true", help="Print timing/source info instead of just the question")
    return p.parse_args()


def main():
    args = parse_args()
    resume_skills = [s.strip() for s in args.resume_skills.split(",") if s.strip()]

    generator = LocalQuestionGenerator()
    result = generator.generate_question(
        skill=args.skill,
        topic=args.topic,
        difficulty=args.difficulty,
        candidate_level=args.level,
        resume_skills=resume_skills,
    )

    if args.verbose:
        print(f"source: {result['source']}")
        print(f"load_time_ms: {generator.last_load_time_ms}")
        print(f"generation_time_ms: {result['generation_time_ms']}")
        print(f"question: {result['question']}")
    else:
        print(result["question"])


if __name__ == "__main__":
    main()
