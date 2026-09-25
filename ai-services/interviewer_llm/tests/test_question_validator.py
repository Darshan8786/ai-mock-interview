"""
Tests for the question validator and the model-free parts of the inference chain.

    # from ai-services/
    python -m unittest interviewer_llm.tests.test_question_validator -v

No model, GPU, network or third-party package is needed.
"""
import unittest

from interviewer_llm.question_validator import clean_generation, is_duplicate, validate_question


class CleanGeneration(unittest.TestCase):
    def test_strips_labels_quotes_numbering_and_extra_lines(self):
        self.assertEqual(clean_generation('Question: "What is a join?"\nAnswer: it combines rows'), "What is a join?")
        self.assertEqual(clean_generation("1. Explain indexing in SQL."), "Explain indexing in SQL.")
        self.assertEqual(clean_generation("- What is a primary key?<|im_end|>"), "What is a primary key?")

    def test_empty_and_none(self):
        self.assertEqual(clean_generation(""), "")
        self.assertEqual(clean_generation(None), "")


class Validate(unittest.TestCase):
    def reasons(self, text, **kw):
        return validate_question(text, **kw).reasons

    def test_accepts_real_questions(self):
        for q, topic in [
            ("Explain the difference between INNER JOIN and LEFT JOIN.", "SQL"),
            ("What is the difference between a process and a thread?", "Operating Systems"),
            ("How does garbage collection work in Java?", "Java"),
            ("Write a function to reverse a linked list and explain its complexity.", "Data Structures"),
        ]:
            with self.subTest(q=q):
                self.assertEqual(self.reasons(q, topic=topic), [])

    def test_rejects_empty_and_too_short(self):
        self.assertIn("empty", self.reasons(""))
        self.assertIn("too_short", self.reasons("SQL?"))
        self.assertIn("too_short", self.reasons("What is it?"))

    def test_rejects_too_long(self):
        self.assertIn("too_long", self.reasons("What is a join " + "and another thing " * 30 + "?"))

    def test_rejects_answer_and_template_leakage(self):
        self.assertIn("prompt_or_answer_leak", self.reasons("Answer: A join combines rows from two tables."))
        self.assertIn("prompt_or_answer_leak", self.reasons("Topic: SQL\nDifficulty: Easy"))
        self.assertIn("prompt_or_answer_leak", self.reasons("What is a join? The answer is that it merges rows.", cleaned=True))

    def test_rejects_repetition(self):
        self.assertIn("repetition", self.reasons("What is what is what is what is a join", topic="SQL"))
        self.assertIn("repetition", self.reasons("Explain the join join operation in the database", topic="SQL"))

    def test_rejects_rambling_multi_question(self):
        self.assertIn("rambling", self.reasons("What is SQL? What is a join? What is an index? What is a key?", cleaned=True))

    def test_rejects_off_topic_for_topics_with_a_vocabulary(self):
        self.assertIn("off_topic", self.reasons("Explain how photosynthesis works in plants.", topic="SQL"))
        self.assertNotIn("off_topic", self.reasons("Explain how photosynthesis works in plants."))  # no topic given -> not judged

    def test_rejects_invalid_format(self):
        self.assertIn("invalid_format", self.reasons("banana table join query index cache"))

    def test_duplicates_exact_and_near(self):
        seen = ["What is the difference between a process and a thread?"]
        self.assertIn("exact_duplicate", self.reasons("what is the difference between a process and a thread", exclude=seen))
        self.assertIn("near_duplicate", self.reasons("What is the difference between a process and a thread in an OS?", exclude=seen))
        self.assertEqual(self.reasons("Explain how virtual memory works.", topic="Operating Systems", exclude=seen), [])
        self.assertIsNone(is_duplicate("Explain paging.", None))


if __name__ == "__main__":
    unittest.main()
