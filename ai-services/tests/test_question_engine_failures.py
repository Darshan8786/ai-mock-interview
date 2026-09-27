"""Failure modes of the question engine's MODEL path: malformed / empty / non-JSON / wrong-key output, exceptions and
slow generations must never crash a request or reach a student - every case falls back to a verified question.
A stub replaces the model (no weights needed); the real validator, verifier and fallbacks run unchanged.

    python tests/test_question_engine_failures.py          (from ai-services/)
"""
import os
import sys
import time
import unittest

os.environ["MULTIDOMAIN_LLM"] = "off"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import question_engine  # noqa: E402
from question_engine import QuestionGenerationService  # noqa: E402

GOOD = {"question": "A number 500 is increased by 20%. What is the new number?", "options": ["580", "600", "620", "640"],
        "answer": "600", "explanation": "500 × 1.20 = 600"}


class StubLLM:
    """Stands in for MultiDomainLLM. `outputs` is what generate() returns (or raises / sleeps)."""

    def __init__(self, outputs=None, raises=None, sleep=0.0, self_answer=None):
        self.outputs, self.raises, self.sleep, self.self_answer = outputs or [], raises, sleep, self_answer
        self.calls = 0
        self.loaded = True

    def generate(self, ctx, n=3):
        self.calls += 1
        if self.sleep:
            time.sleep(self.sleep)
        if self.raises:
            raise self.raises
        return list(self.outputs)

    def answer_mcq(self, question, options):
        return self.self_answer

    def status(self):
        return {"stub": True}


def service(llm) -> QuestionGenerationService:
    s = QuestionGenerationService()
    s.llm = llm
    return s


class ModelFailuresFallBack(unittest.TestCase):
    def assert_verified_fallback(self, r):
        self.assertNotIn("error", r)
        self.assertIn(r["source"], ("template", "bank"))
        self.assertEqual(len(set(r["options"])), 4)
        self.assertTrue(0 <= r["answer_index"] < 4)

    def test_empty_output(self):
        r = service(StubLLM(outputs=[])).generate_aptitude_question("Quantitative", "Percentages", "medium")
        self.assert_verified_fallback(r)
        self.assertIn("unparseable_output", r["rejection_reasons"])

    def test_malformed_structures(self):
        bad = [
            {"question": "What is 20% of 150?"},                                              # no options/answer
            {**GOOD, "options": ["600", "600", "620", "640"]},                                # duplicate options
            {**GOOD, "options": ["580", "600", "620"]},                                       # 3 options
            {**GOOD, "answer": "601"},                                                        # answer not an option
            {**GOOD, "explanation": ""},                                                      # no explanation
            {**GOOD, "question": ""},                                                         # empty question
            {**GOOD, "options": "580, 600, 620, 640"},                                        # wrong type
        ]
        r = service(StubLLM(outputs=bad)).generate_aptitude_question("Quantitative", "Percentages", "medium")
        self.assert_verified_fallback(r)
        for reason in ("options_must_be_4_non_empty", "duplicate_options", "answer_not_exactly_one_option", "missing_explanation", "empty_question"):
            self.assertIn(reason, r["rejection_reasons"])

    def test_wrong_answer_key_never_served(self):
        wrong = {**GOOD, "answer": "620", "explanation": "500 × 1.24 = 620"}
        r = service(StubLLM(outputs=[wrong])).generate_aptitude_question("Quantitative", "Percentages", "medium")
        self.assert_verified_fallback(r)
        self.assertIn("answer_key_contradicted", r["rejection_reasons"])

    def test_model_exception(self):
        r = service(StubLLM(raises=RuntimeError("CUDA error"))).generate_aptitude_question("Quantitative", "Averages", "easy")
        self.assert_verified_fallback(r)
        self.assertTrue(any(x.startswith("generation_error") for x in r["rejection_reasons"]))

    def test_slow_model_bounded_by_budget(self):
        old = question_engine.MODEL_BUDGET_S
        question_engine.MODEL_BUDGET_S = 0.3
        try:
            llm = StubLLM(outputs=[], sleep=0.5)
            t0 = time.time()
            r = service(llm).generate_aptitude_question("Quantitative", "Percentages", "medium")
            self.assert_verified_fallback(r)
            self.assertEqual(llm.calls, 1)                 # no second batch after the deadline
            self.assertLess(time.time() - t0, 3)
        finally:
            question_engine.MODEL_BUDGET_S = old

    def test_valid_output_is_served_as_model(self):
        r = service(StubLLM(outputs=[GOOD])).generate_aptitude_question("Quantitative", "Percentages", "medium")
        self.assertEqual(r["source"], "model")
        self.assertEqual(r["verification"], "deterministic")
        self.assertEqual(r["options"][r["answer_index"]], "600")

    def test_duplicate_of_history_not_served(self):
        r = service(StubLLM(outputs=[GOOD])).generate_aptitude_question("Quantitative", "Percentages", "medium", exclude=[GOOD["question"]])
        self.assertNotEqual(r["question"], GOOD["question"])
        self.assertIn("exact_duplicate", r["rejection_reasons"])

    def test_strict_mode_never_serves_unprovable_model_items(self):
        verbal = {"question": "Choose the word most similar in meaning to 'Abundant'.", "options": ["Scarce", "Plentiful", "Tiny", "Rare"],
                  "answer": "Plentiful", "explanation": "Abundant means existing in large quantities, i.e. plentiful."}
        llm = StubLLM(outputs=[verbal], self_answer="Plentiful")
        r = service(llm).generate_aptitude_question("Verbal Ability", "Synonyms & Antonyms", "easy")
        self.assertEqual(r["source"], "bank")
        self.assertEqual(llm.calls, 0)                      # strict: the model is not even asked
        t = service(StubLLM(outputs=[{"question": "x"}])).generate_tech_question("Java", "", "medium", "mcq")
        self.assertEqual(t["source"], "bank")


if __name__ == "__main__":
    unittest.main()
