"""Tests for the explainable mock-interview feedback (interview_feedback_analysis +
local_answer_evaluator extensions). Run from ai-services/:

    python -m unittest tests.test_interview_feedback -v
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import interview_feedback_analysis as fa  # noqa: E402
from local_answer_evaluator import evaluate_answer  # noqa: E402

TECH_Q = "What is the difference between a primary key and a foreign key in SQL?"
GOOD_TECH = (
    "A primary key is a column that uniquely identifies each row in a table and cannot be null. "
    "A foreign key is a column that refers to the primary key of another table, because it links "
    "the two tables and enforces referential integrity. For example, an orders table has a "
    "customer_id foreign key that points to the customers table. In short, the primary key "
    "identifies a row and the foreign key connects rows across tables."
)
LEGACY_KEYS = {
    "technicalScore", "communicationScore", "confidenceScore", "grammarScore",
    "fluencyScore", "relevanceScore", "feedback",
}


def ev(question=TECH_Q, answer=GOOD_TECH, interview_type="Technical", **kw):
    return evaluate_answer(
        question=question, answer=answer, interview_type=interview_type,
        difficulty="Medium", job_role="Backend Developer", skill=kw.pop("skill", "SQL"),
        topic=kw.pop("topic", "Keys"), **kw,
    )


class LegacyContract(unittest.TestCase):
    def test_legacy_fields_unchanged_and_present(self):
        r = ev()
        self.assertTrue(LEGACY_KEYS.issubset(r.keys()))
        for k in LEGACY_KEYS - {"feedback"}:
            self.assertTrue(0 <= r[k] <= 100, k)

    def test_legacy_scores_do_not_depend_on_audio_metadata(self):
        base = ev()
        with_speech = ev(answer_type="voice", speech={"recordingSeconds": 40, "pauseDetection": True, "pauses": []})
        for k in LEGACY_KEYS:
            self.assertEqual(base[k], with_speech[k], k)

    def test_empty_answer_still_scores_zero(self):
        r = ev(answer="   ")
        self.assertEqual(r["technicalScore"], 0)
        self.assertNotIn("analysis", r)


class ExtendedScores(unittest.TestCase):
    def test_new_scores_present_and_bounded(self):
        r = ev()
        for k in ("structureScore", "completenessScore", "clarityScore", "concisenessScore"):
            self.assertTrue(0 <= r[k] <= 100, k)
        self.assertEqual(r["analysis"]["version"], fa.ANALYSIS_VERSION)

    def test_structured_answer_outscores_bare_statement(self):
        weak = ev(answer="primary key is unique and foreign key links tables")
        self.assertGreater(ev()["structureScore"], weak["structureScore"])

    def test_every_metric_has_an_explanation(self):
        expl = ev()["analysis"]["explanations"]
        for key in ("technical", "communication", "confidence", "grammar", "fluency",
                    "relevance", "structure", "completeness", "clarity", "conciseness"):
            self.assertIn(key, expl)
            self.assertEqual(set(expl[key]) - {"note"}, {"score", "good", "missing", "improve"})

    def test_missing_answer_key_is_a_note_not_a_strength(self):
        a = ev(question="What is a zebra crossing?", skill="", topic="", answer="A zebra crossing is a place to cross the road safely.")["analysis"]
        tech = a["explanations"]["technical"]
        self.assertIn("answer key", tech["note"])
        self.assertFalse(any("answer key" in g for g in tech["good"]))

    def test_reasons_are_grounded_in_the_answer(self):
        a = ev()["analysis"]
        # matched concepts are listed as "good", and never also as missing
        self.assertFalse(set(a["matchedConcepts"]) & set(a["missingConcepts"]))
        tech = a["explanations"]["technical"]
        if a["missingConcepts"]:
            self.assertTrue(any(m in " ".join(tech["missing"]) for m in a["missingConcepts"][:5]))

    def test_short_answer_is_flagged_not_praised(self):
        r = ev(answer="It is a key.")
        a = r["analysis"]
        self.assertEqual(a["communication"]["length"], "extremely_short")
        self.assertLessEqual(r["concisenessScore"], 40)
        self.assertLessEqual(r["structureScore"], 20)
        self.assertNotIn("Answer length was appropriate", a["strengths"])

    def test_hedging_reported_from_actual_phrases(self):
        r = ev(answer="I think a primary key is maybe unique, I'm not sure about foreign keys really.")
        self.assertTrue(r["analysis"]["communication"]["hedgingPhrases"]["count"] >= 2)
        # "not sure" is subsumed by "i'm not sure" and must not be listed twice
        items = r["analysis"]["communication"]["hedgingPhrases"]["items"]
        self.assertNotIn("not sure", items)


class StructureChoice(unittest.TestCase):
    def test_type_follows_the_question(self):
        self.assertEqual(fa.classify_question(TECH_Q, "Technical"), "technical")
        self.assertEqual(fa.classify_question("Tell me about a time you handled a conflict.", "Behavioral"), "behavioral")
        self.assertEqual(fa.classify_question("Why do you want this job?", "HR"), "hr")
        self.assertEqual(fa.classify_question("Tell me about a time you disagreed with a teammate", "HR"), "behavioral")
        self.assertEqual(fa.classify_question('Tell me about your project "Shop"', "Resume", "Project"), "project")
        self.assertEqual(fa.classify_question("Explain your final year project.", "Technical"), "project")

    def test_star_elements_detected(self):
        answer = (
            "In my final year, our team had a deadline conflict. My task was to coordinate the release. "
            "I organised a daily stand-up and divided the work. As a result we delivered on time and "
            "improved test coverage by 30%."
        )
        r = ev(question="Tell me about a time you handled a conflict.", answer=answer,
               interview_type="Behavioral", skill="Behavioral", topic="")
        st = r["analysis"]["structure"]
        self.assertEqual(st["type"], "behavioral")
        found = {e["key"] for e in st["elements"] if e["found"]}
        self.assertEqual(found, {"situation", "task", "action", "result"})
        self.assertEqual(st["score"], 100)
        self.assertEqual(st["missing"], [])

    def test_missing_project_parts_reported_with_recommendation(self):
        r = ev(question='Tell me about your project "Shop". What problem does it solve?',
               answer="It is an online shop where people can buy things and I made it in a week.",
               interview_type="Resume", skill="Project", topic="Shop")
        st = r["analysis"]["structure"]
        self.assertEqual(st["type"], "project")
        self.assertIn("Result", st["missing"])
        self.assertIn("Start with the problem", st["recommendation"])


class CommunicationHonesty(unittest.TestCase):
    def test_text_answer_has_no_audio_metrics(self):
        c = ev()["analysis"]["communication"]
        self.assertIsNone(c["speakingRate"])
        self.assertIsNone(c["longPauses"])

    def test_text_answer_ignores_supplied_speech_metadata(self):
        c = ev(answer_type="text", speech={"recordingSeconds": 60, "pauseDetection": True, "pauses": []})["analysis"]["communication"]
        self.assertIsNone(c["speakingRate"])

    def test_voice_without_pause_detection_reports_pauses_unavailable(self):
        c = ev(answer_type="voice", speech={"recordingSeconds": 40})["analysis"]["communication"]
        self.assertIsNone(c["longPauses"])
        self.assertIsNotNone(c["speakingRate"])  # duration + words are real

    def test_voice_speaking_rate_and_pauses(self):
        speech = {
            "recordingSeconds": 45, "pauseDetection": True,
            "pauses": [{"startSeconds": 12, "durationSeconds": 3.4}, {"startSeconds": 30, "durationSeconds": 1.1}],
        }
        c = ev(answer_type="voice", speech=speech)["analysis"]["communication"]
        words = c["wordCount"]
        self.assertEqual(c["speakingRate"]["wpm"], round(words / (45 / 60)))
        self.assertEqual(c["longPauses"]["count"], 1)  # 1.1s is under the 2s threshold
        self.assertEqual(c["durationSeconds"], 45)
        self.assertEqual(c["durationSource"], "recording")

    def test_rate_needs_enough_audio_and_words(self):
        c = ev(answer="short answer here", answer_type="voice", speech={"recordingSeconds": 4})["analysis"]["communication"]
        self.assertIsNone(c["speakingRate"])

    def test_hostile_speech_payload_is_dropped(self):
        for bad in ("x", {"recordingSeconds": "nan"}, {"recordingSeconds": -5}, {"recordingSeconds": 10**9}, [1]):
            self.assertEqual(fa.sanitize_speech(bad), {})

    def test_time_on_question_used_only_as_labelled_fallback(self):
        c = ev(time_taken=62)["analysis"]["communication"]
        self.assertEqual(c["durationSource"], "time_on_question")
        self.assertEqual(c["durationLabel"], "1m 02s")
        self.assertIsNone(ev()["analysis"]["communication"]["durationSeconds"])


class TimelineHonesty(unittest.TestCase):
    def test_timestamps_only_for_measured_pauses(self):
        speech = {"recordingSeconds": 50, "pauseDetection": True, "pauses": [{"startSeconds": 20.5, "durationSeconds": 4}]}
        tl = ev(answer_type="voice", speech=speech)["analysis"]["timeline"]
        timed = [e for e in tl if e["atSeconds"] is not None]
        self.assertEqual(len(timed), 1)
        self.assertTrue(timed[0]["label"].startswith("Long pause"))
        self.assertEqual(timed[0]["atSeconds"], 20.5)

    def test_text_timeline_has_no_timestamps(self):
        tl = ev()["analysis"]["timeline"]
        self.assertTrue(tl)
        self.assertTrue(all(e["atSeconds"] is None for e in tl))
        for e in tl:
            self.assertIn(e["kind"], ("good", "warn", "bad"))
            if e["position"] is not None:
                self.assertTrue(0 <= e["position"] <= 1)

    def test_filler_and_repeat_events_come_from_the_transcript(self):
        r = ev(answer="Basically a primary key is like the the unique identifier, basically it is like a row id in the table.")
        labels = " ".join(e["label"] for e in r["analysis"]["timeline"])
        self.assertIn("Filler word", labels)
        self.assertIn("Repeated phrase", labels)


if __name__ == "__main__":
    unittest.main()
