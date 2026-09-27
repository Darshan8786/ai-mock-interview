"""Unit tests for the deterministic aptitude answer verifier.

    python -m unittest interviewer_llm.tests.test_numeric_verifier      (from ai-services/)
"""
import unittest

from interviewer_llm.numeric_verifier import (check_explanation, parse_number, safe_eval, solve,
                                               verify_numeric_mcq)


class SafeEval(unittest.TestCase):
    def test_plain_arithmetic_only(self):
        self.assertEqual(safe_eval("1000*8*2/100"), 160)
        self.assertIsNone(safe_eval("__import__('os')"))
        self.assertIsNone(safe_eval("10 % 3"))          # '%' is never modulo in aptitude text
        self.assertIsNone(safe_eval("2**999999"))


class Parsing(unittest.TestCase):
    def test_option_values(self):
        self.assertEqual(parse_number("₹1,200"), 1200)
        self.assertEqual(parse_number("36 km/h"), 36)
        self.assertEqual(parse_number("12.5%"), 12.5)
        self.assertEqual(parse_number("1/4"), 0.25)
        self.assertIsNone(parse_number("No change"))
        self.assertIsNone(parse_number("4% decrease"))
        self.assertIsNone(parse_number("B by 30"))


class Solvers(unittest.TestCase):
    def test_shapes(self):
        self.assertAlmostEqual(solve("What is 20% of 150?"), 30)
        self.assertAlmostEqual(solve("A number 500 is increased by 20%. What is the new number?"), 600)
        self.assertAlmostEqual(solve("Simple interest on ₹1000 at 8% per annum for 2 years is:"), 160)
        self.assertAlmostEqual(solve("Compound interest on ₹5000 at 10% per annum for 2 years (compounded annually) is:"), 1050)
        self.assertAlmostEqual(solve("A alone can do a work in 10 days and B alone in 15 days. Working together, they will finish in:"), 6)
        self.assertAlmostEqual(solve("A train 150 m long crosses a pole in 15 seconds. Its speed in km/h is:"), 36)
        self.assertAlmostEqual(solve("Find the next term: 2, 6, 12, 20, 30, ?", "Number Series"), 42)
        self.assertAlmostEqual(solve("Find the next term: 3, 6, 12, 24, ?", "Number Series"), 48)


class Verdicts(unittest.TestCase):
    OPTS = ["₹580", "₹600", "₹620", "₹640"]

    def test_spec_example_correct_key_is_verified(self):
        v = verify_numeric_mcq("A number 500 is increased by 20%. What is the new number?", ["580", "600", "620", "640"], 1,
                               "500 × 1.20 = 600")
        self.assertEqual(v.status, "verified")

    def test_spec_example_wrong_key_is_rejected(self):
        v = verify_numeric_mcq("A number 500 is increased by 20%. What is the new number?", ["580", "600", "620", "640"], 2,
                               "500 × 1.20 = 620")
        self.assertEqual(v.status, "contradicted")
        self.assertIn("solver_matches_other_option", v.reasons)

    def test_false_equality_in_working(self):
        v = verify_numeric_mcq("A shopkeeper marks an item at ₹800 and gives a 25% discount. The selling price is:",
                               ["₹560", "₹600", "₹640", "₹700"], 2, "SP = 800 × 0.75 = 640")
        self.assertEqual(v.status, "contradicted")
        self.assertIn("explanation_arithmetic_error", v.reasons)

    def test_working_reaches_other_option(self):
        v = verify_numeric_mcq("The average of four weekly sales figures 120, 150, 140 and 160 is:", ["138", "140", "142", "145"], 3,
                               "(120+150+140+160)/4 = 570/4 = 142.5")
        self.assertEqual(v.status, "contradicted")

    def test_rounded_answer_accepted(self):
        v = verify_numeric_mcq("Weekly sales are 120, 150, 140 and 160 units. The average weekly sale is about:", ["138", "140", "142", "145"], 2,
                               "(120+150+140+160)/4 = 570/4 = 142.5")
        self.assertEqual(v.status, "verified")

    def test_duplicate_option_values(self):
        v = verify_numeric_mcq("0.05 as a fraction in lowest terms is:", ["5/10", "1/20", "1/5", "5/100"], 1, "0.05 = 5/100 = 1/20")
        self.assertIn("duplicate_option_values", v.reasons)

    def test_no_correct_option(self):
        v = verify_numeric_mcq("What is 20% of 150?", ["20", "25", "35", "40"], 1, "150 × 20/100 = 30")
        self.assertEqual(v.status, "contradicted")
        self.assertIn("no_option_matches_solver", v.reasons)

    def test_variables_substituted_back(self):
        e = "4x−5y=600, 5x−6y=600 → x=600,y=360 → A income 2400"
        self.assertTrue(check_explanation(e).errors)

    def test_unit_conversion_is_not_an_error(self):
        self.assertFalse(check_explanation("Speed = 150/15 = 10 m/s = 10 × 18/5 = 36 km/h").errors)
        self.assertFalse(check_explanation("Difference 55% − 45% = 10% = 800 → total = 8000").errors)
        self.assertFalse(check_explanation("(3/8 ÷ 3/4) × 100 = (3/8 × 4/3) × 100 = 50%").errors)
        self.assertFalse(check_explanation("Minutes past 3 = 3×60/11 = 16 4/11").errors)

    def test_missing_answer(self):
        v = verify_numeric_mcq("What is 20% of 150?", ["20", "25", "30", "35"], 7, "150 × 20/100 = 30")
        self.assertEqual(v.status, "contradicted")


if __name__ == "__main__":
    unittest.main()
