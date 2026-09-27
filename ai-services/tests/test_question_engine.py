"""Question engine + structured validator (no model needed: MULTIDOMAIN_LLM=off exercises the verified fallbacks).

    python tests/test_question_engine.py          (from ai-services/)
"""
import os
import sys
import unittest

os.environ["MULTIDOMAIN_LLM"] = "off"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from interviewer_llm.structured_validator import parse_json_output, validate_structured  # noqa: E402
from question_engine import get_question_service  # noqa: E402
from tech_answer_evaluator import evaluate_tech_record  # noqa: E402

APT = {"domain": "aptitude", "category": "Quantitative", "topic": "Percentages", "difficulty": "medium", "question_type": "mcq"}
TECH = {"domain": "tech", "technology": "Java", "topic": "Collections", "difficulty": "medium", "question_type": "mcq"}


class Validator(unittest.TestCase):
    def good(self, **kw):
        base = {"question": "A number 500 is increased by 20%. What is the new number?", "options": ["580", "600", "620", "640"],
                "answer": "600", "explanation": "500 × 1.20 = 600"}
        base.update(kw)
        return base

    def test_parse_json_output(self):
        self.assertEqual(parse_json_output('noise {"a": {"b": 1}} trailing')["a"]["b"], 1)
        self.assertIsNone(parse_json_output("no json here"))
        self.assertIsNone(parse_json_output('{"broken": '))

    def test_valid_aptitude_is_deterministically_verified(self):
        v = validate_structured(self.good(), APT)
        self.assertTrue(v.ok, v.reasons)
        self.assertEqual(v.verification, "deterministic")

    def test_wrong_key_rejected(self):
        v = validate_structured(self.good(answer="620", explanation="500 × 1.24 = 620"), APT)
        self.assertIn("answer_key_contradicted", v.reasons)

    def test_structure_rules(self):
        self.assertIn("options_must_be_4_non_empty", validate_structured(self.good(options=["1", "2", "3"]), APT).reasons)
        self.assertIn("duplicate_options", validate_structured(self.good(options=["600", "600 ", "620", "640"]), APT).reasons)
        self.assertIn("answer_not_exactly_one_option", validate_structured(self.good(answer="601"), APT).reasons)
        self.assertIn("missing_explanation", validate_structured(self.good(explanation=""), APT).reasons)
        self.assertIn("prompt_leak", validate_structured(self.good(question="Context: {domain} what is 20% of 150?"), APT).reasons)

    def test_duplicates(self):
        q = self.good()["question"]
        self.assertIn("exact_duplicate", validate_structured(self.good(), APT, exclude=[q]).reasons)
        self.assertIn("same_template_in_session",
                      validate_structured(self.good(), APT, session_exclude=["A number 750 is increased by 10%. What is the new number?"]).reasons)

    def test_tech_requires_concepts(self):
        rec = {"question": "Which collection does not allow duplicate elements?", "options": ["ArrayList", "HashSet", "LinkedList", "Vector"],
               "answer": "HashSet", "explanation": "A Set stores unique elements.", "concepts": []}
        self.assertIn("missing_concepts", validate_structured(rec, TECH).reasons)
        rec["concepts"] = ["Set", "uniqueness"]
        self.assertTrue(validate_structured(rec, TECH).ok)


class EngineFallbacks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = get_question_service()

    def test_aptitude_template_fallback_is_verified_and_unique_in_session(self):
        seen = []
        for _ in range(8):
            r = self.s.generate_aptitude_question("Quantitative", "Percentages", "medium", session=seen)
            self.assertIn(r["source"], ("template", "bank"))
            self.assertEqual(len(set(r["options"])), 4)
            self.assertTrue(0 <= r["answer_index"] < 4)
            self.assertNotIn(r["question"], seen)
            seen.append(r["question"])

    def test_aptitude_non_numeric_from_verified_bank(self):
        r = self.s.generate_aptitude_question("Verbal Ability", "Synonyms & Antonyms", "easy")
        self.assertEqual(r["source"], "bank")
        self.assertEqual(r["topic"], "Synonyms & Antonyms")

    def test_excluded_history_is_not_repeated(self):
        first = self.s.generate_aptitude_question("Logical Reasoning", "Blood Relations", "medium")
        again = self.s.generate_aptitude_question("Logical Reasoning", "Blood Relations", "medium", exclude=[first["question"]])
        self.assertNotEqual(first["question"], again["question"])

    def test_tech_types_and_evaluation(self):
        for qt, dataset_types in [("mcq", {"MCQ"}), ("output_prediction", {"Output Prediction"}), ("debugging", {"Debugging"})]:
            r = self.s.generate_tech_question("Python", "", "medium", qt)
            self.assertIn(r["question_type"], dataset_types)
            ans = r["correct_option"] if qt == "mcq" else r["answer"]
            ev = evaluate_tech_record(r, ans)
            self.assertTrue(ev["isCorrect"], (qt, ev))
            self.assertIn("missingConcepts", ev)
            self.assertIn("recommendation", ev)

    def test_unknown_technology(self):
        self.assertIn("error", self.s.generate_tech_question("Cobol"))


if __name__ == "__main__":
    unittest.main()
