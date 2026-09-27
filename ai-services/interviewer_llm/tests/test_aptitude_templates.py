"""Every templated aptitude question must independently pass the numeric verifier (two code paths agree).

    python -m unittest interviewer_llm.tests.test_aptitude_templates      (from ai-services/)
"""
import random
import unittest

from interviewer_llm import aptitude_templates as T
from interviewer_llm.numeric_verifier import verify_numeric_mcq


class TemplatesVerify(unittest.TestCase):
    def test_all_topics_all_difficulties(self):
        for topic in T.supported_topics():
            for diff in T.DIFFS:
                for seed in range(60):
                    item = T.generate(topic, diff, random.Random(seed))
                    with self.subTest(topic=topic, diff=diff, seed=seed):
                        self.assertEqual(len(item["options"]), 4)
                        self.assertEqual(len(set(item["options"])), 4)
                        self.assertEqual(item["options"][item["answer_index"]], item["answer"])
                        v = verify_numeric_mcq(item["question"], item["options"], item["answer_index"], item["explanation"], topic)
                        self.assertEqual(v.status, "verified", (item, v))

    def test_unknown_topic(self):
        self.assertIsNone(T.generate("Reading Comprehension"))


if __name__ == "__main__":
    unittest.main()
