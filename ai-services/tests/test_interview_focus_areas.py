"""Personalised question selection: focus areas bias (but do not take over) the technical
question mix. Generator and history store are mocked so nothing touches the real global
question-history file. Run from ai-services/:  python tests/test_interview_focus_areas.py
"""
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import interview_question_service as svc  # noqa: E402


class FakeGenerator:
    def __init__(self):
        self.n = 0

    def generate_question(self, skill, topic, **kw):
        self.n += 1
        return {"question": f"Q{self.n} about {skill}/{topic}?", "source": "fake"}


class FakeStore:
    def is_duplicate(self, *a, **k):
        return False

    def mark_used(self, *a, **k):
        pass


def run(total, focus):
    with mock.patch.object(svc, "get_generator", return_value=FakeGenerator()), \
         mock.patch.object(svc, "get_store", return_value=FakeStore()):
        return svc.generate_technical_questions(
            "Backend Developer", "fresher", "Medium", total, [], "", "u", "s", focus_areas=focus
        )


class FocusAreas(unittest.TestCase):
    def test_no_focus_is_unchanged_behaviour(self):
        qs = run(5, None)
        self.assertEqual(len(qs), 5)
        self.assertTrue(all("focusArea" not in q for q in qs))

    def test_focus_gets_a_share_not_everything(self):
        qs = run(5, [{"skill": "DBMS", "topic": "Normalization"}])
        focused = [q for q in qs if q.get("focusArea")]
        self.assertEqual(len(qs), 5)
        self.assertEqual(len(focused), 2)  # round(5 * 0.4)
        self.assertTrue(all(q["skill"] == "DBMS" and q["topic"] == "Normalization" for q in focused))
        self.assertEqual(focused[0]["focusArea"], "DBMS: Normalization")

    def test_unknown_skills_are_ignored_not_invented(self):
        qs = run(4, [{"skill": "Underwater Basket Weaving"}, "junk", None])
        self.assertTrue(all("focusArea" not in q for q in qs))

    def test_skill_without_topic_picks_a_real_topic(self):
        qs = run(5, [{"skill": "SQL"}])
        focused = [q for q in qs if q.get("focusArea")]
        self.assertTrue(focused)
        self.assertIn(focused[0]["topic"], svc._topics_for_skill("SQL"))


if __name__ == "__main__":
    unittest.main()
