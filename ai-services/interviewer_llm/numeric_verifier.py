"""
Deterministic numerical verification of aptitude MCQs - the gate that stops a wrong answer key from ever reaching a
student. Pure Python (ast-based arithmetic, no eval of arbitrary code), no ML, no network.

The language model (or a human author) supplies question + options + claimed answer + explanation. This module never
trusts the claimed answer; it recomputes what it can and compares:

  1. TOPIC SOLVERS - regex-parse well-structured question shapes ("What is 20% of 150?", "SI on 1000 at 8% for 2 years",
     "A can do a work in 10 days and B in 15 days ... together", "a train 150 m long crosses a pole in 15 s", number
     series, ...) and compute the answer independently of the explanation. A solver result is authoritative.
  2. EXPLANATION ARITHMETIC - every "expr = value" chain in the explanation is evaluated; a single false equality
     (e.g. "500 * 1.2 = 620") is a contradiction. Single-letter variables the explanation solves for ("x = 600, y = 360")
     are substituted back into its own equations ("5x - 6y = 600"), which catches keys whose working does not hold.
  3. ANSWER SUPPORT - the claimed option's value must be what the working arrives at; if the working instead arrives at a
     DIFFERENT option, the key is contradicted.

    result = verify_numeric_mcq(question, options, answer_index, explanation, topic="Percentages")
    result.status   -> "verified" | "contradicted" | "unverifiable"
    result.reasons  -> machine-readable reason codes
    result.computed -> the value a solver / the working produced (if any)
"""
from __future__ import annotations

import ast
import math
import operator
import re
from dataclasses import dataclass, field
from fractions import Fraction

# ── safe arithmetic ────────────────────────────────────────────────────────────
# No Mod: in aptitude text "%" always means percent, never modulo.
_BIN = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
        ast.Pow: operator.pow}
_UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}
_FUNCS = {"sqrt": math.sqrt}


def _eval_node(node, env: dict[str, float]) -> float:
    if isinstance(node, ast.Expression):
        return _eval_node(node.body, env)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
        return float(node.value)
    if isinstance(node, ast.BinOp) and type(node.op) in _BIN:
        left, right = _eval_node(node.left, env), _eval_node(node.right, env)
        if isinstance(node.op, ast.Pow) and (abs(right) > 12 or abs(left) > 1e6):
            raise ValueError("exponent out of range")
        return float(_BIN[type(node.op)](left, right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY:
        return float(_UNARY[type(node.op)](_eval_node(node.operand, env)))
    if isinstance(node, ast.Name) and node.id in env:
        return float(env[node.id])
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in _FUNCS and len(node.args) == 1:
        return float(_FUNCS[node.func.id](_eval_node(node.args[0], env)))
    raise ValueError("not plain arithmetic")


def safe_eval(expr: str, env: dict[str, float] | None = None) -> float | None:
    """Value of a plain arithmetic expression (numbers, + - * / ** %, parentheses, sqrt, known variables) or None."""
    try:
        tree = ast.parse(expr.strip(), mode="eval")
        value = _eval_node(tree, env or {})
    except (SyntaxError, ValueError, TypeError, ZeroDivisionError, OverflowError, RecursionError):
        return None
    return value if math.isfinite(value) else None


# ── text -> expression normalisation ───────────────────────────────────────────
_CURRENCY = re.compile(r"₹|rs\.?\s*(?=\d)|\$|inr\s*(?=\d)", re.I)
_UNIT_WORDS = {
    "km/h", "kmph", "km/hr", "m/s", "km", "m", "cm", "mm", "hours", "hour", "hrs", "hr", "h", "min", "mins", "minutes",
    "minute", "s", "sec", "secs", "seconds", "second", "days", "day", "years", "year", "yrs", "months", "month", "weeks",
    "litres", "liters", "litre", "liter", "l", "kg", "g", "grams", "metres", "meters", "metre", "meter", "m²", "cm²",
    "m³", "cm³", "sq", "units", "unit", "rupees", "paise", "men", "persons", "workers", "women", "boys", "girls",
    "students", "people", "marks", "votes", "degrees", "degree", "°", "times", "ways", "items", "articles", "pages",
    "sq m", "sq cm", "cubic cm", "cubic m", "km²", "am", "pm", "percent", "p.a.", "pa", "per annum", "numbers", "balls",
}


def _normalise_expr(text: str) -> str:
    t = text.strip()
    t = _CURRENCY.sub("", t)
    t = re.sub(r"(?<=\d),(?=\d{3}\b)", "", t)                      # 1,200 -> 1200
    t = (t.replace("×", "*").replace("✕", "*").replace("∗", "*").replace("·", "*").replace("÷", "/")
         .replace("−", "-").replace("–", "-").replace("—", "-").replace("^", "**")
         .replace("²", "**2").replace("³", "**3"))
    t = re.sub(r"√\s*\(", "sqrt(", t)
    t = re.sub(r"√\s*(\d+(?:\.\d+)?)", r"sqrt(\1)", t)
    t = re.sub(r"(?<=[\d)])\s*[xX]\s*(?=[\d(])", "*", t)             # 5 x 3 -> 5*3
    t = re.sub(r"(\d+(?:\.\d+)?)\s*%\s*of\s*", r"(\1/100)*", t, flags=re.I)
    t = re.sub(r"(?<![\d.])(\d+)\s+(\d+)/(\d+)(?![\d.])", r"(\1+\2/\3)", t)   # mixed number 16 4/11
    # "3/8 ÷ 3/4" means (3/8)/(3/4): a written fraction stays atomic
    t = re.sub(r"(?<![\d.)/])(\d+(?:\.\d+)?)/(\d+(?:\.\d+)?)(?![\d.(/]|\*\*)", r"(\1/\2)", t)
    t = re.sub(r"\[|\{", "(", t)
    t = re.sub(r"\]|\}", ")", t)
    return t.strip()


def _implicit_mult(expr: str, variables: set[str]) -> str:
    e = re.sub(r"(\d)\s*\(", r"\1*(", expr)
    e = re.sub(r"\)\s*(?=[\d(])", ")*", e)
    if variables:
        names = "".join(sorted(v for v in variables if len(v) == 1))
        if names:
            e = re.sub(rf"(\d|\))\s*([{names}])\b", r"\1*\2", e)
            e = re.sub(rf"\b([{names}])\s*\(", r"\1*(", e)
    return e


@dataclass
class Quantity:
    value: float
    unit: str = ""
    percent: bool = False
    decimals: int = 0


def _decimals_in(text: str) -> int:
    m = re.findall(r"\d+\.(\d+)", text)
    return max((len(x) for x in m), default=0)


def eval_part(part: str, env: dict[str, float] | None = None) -> Quantity | None:
    """Value of one side of an equality ("1000 × 8 × 2 / 100", "₹160", "36 km/h", "70%", "3×6 : 4×5"), or None when
    the part is prose / has letters that are neither a unit nor a known variable."""
    env = env or {}
    raw = part.strip().rstrip(".").strip()
    if not raw or not re.search(r"\d", raw):
        return None
    if re.match(r"^\s*[+*/×÷]", raw):                                    # "+40 = 100": a continuation, not a value
        return None
    t = _normalise_expr(raw)
    percent = False
    n_pct, n_num = len(re.findall(r"\d\s*%", t)), len(re.findall(r"\d+(?:\.\d+)?", re.sub(r"\*\*\d", "", t)))
    if n_pct and n_pct >= n_num:                                         # "30% + 20%", "70%": a percentage value
        percent, t = True, t.replace("%", "")
    elif n_pct:                                                          # "150 × 20%": percent of something
        t = re.sub(r"(\d+(?:\.\d+)?)\s*%", r"(\1/100)", t)
    unit = ""
    m = re.match(r"^(?P<expr>.*?[\d)])\s*(?P<unit>[A-Za-z°²³/ .]+)$", t)
    if m and not set(m.group("unit").strip().lower().split()) <= set(env):
        u = m.group("unit").strip().lower().rstrip(".")
        if u in _UNIT_WORDS:
            unit, t = u, m.group("expr")
        elif not all(w in env for w in re.findall(r"[a-z]+", u)):
            return None
    if ":" in t:                                                         # ratio a:b -> a/b
        sides = t.split(":")
        if len(sides) != 2:
            return None
        a, b = safe_eval(_implicit_mult(sides[0], set(env)), env), safe_eval(_implicit_mult(sides[1], set(env)), env)
        if a is None or b in (None, 0.0):
            return None
        return Quantity(a / b, "ratio", False, 0)
    if re.search(r"[A-Za-z]", re.sub(r"sqrt", "", t)):
        letters = set(re.findall(r"[A-Za-z]+", re.sub(r"sqrt", "", t)))
        if not letters <= set(env):
            return None
    value = safe_eval(_implicit_mult(t, set(env)), env)
    if value is None:
        return None
    return Quantity(value, unit, percent, _decimals_in(raw))


def close(a: float, b: float, decimals: int = 0) -> bool:
    """Equal up to how precisely the number was WRITTEN: "6.67" matches 200/30 and "66.66" (truncated) matches 200/3,
    but "1005" never matches 1008."""
    tol = (10 ** (-decimals) if decimals else 0.0) + 1e-6 * max(1.0, abs(a), abs(b))
    return abs(a - b) <= tol


def exactly(a: float, b: float) -> bool:
    return abs(a - b) <= 1e-9 * max(1.0, abs(a), abs(b))


def _same(q1: Quantity, q2: Quantity) -> bool | None:
    """True/False when the two sides are comparable, None when their units differ (e.g. 10 m/s = 36 km/h)."""
    if q1.unit and q2.unit and q1.unit != q2.unit:
        return None
    if (q1.unit == "ratio") != (q2.unit == "ratio"):                     # "6: 120 x 6 = 720" is prose, not a ratio
        return None
    dec = max(q1.decimals, q2.decimals)
    if close(q1.value, q2.value, dec):
        return True
    if q1.percent != q2.percent:
        # "70% = 0.7" is an equality, but "10% = 800" is aptitude shorthand for "10% corresponds to 800" - not
        # something arithmetic can refute, so it is skipped rather than flagged.
        pct, other = (q1, q2) if q1.percent else (q2, q1)
        return True if close(pct.value / 100, other.value, dec + 2) else None
    return False


# ── numbers mentioned in text / options ───────────────────────────────────────
_NUM = re.compile(r"(?<![\w.])-?\d[\d,]*(?:\.\d+)?(?:\s*/\s*\d+(?:\.\d+)?)?")


def parse_number(text: str) -> float | None:
    """Numeric value of an option such as "₹1,200", "36 km/h", "12.5%", "1/4", "6.67 s", "24 hours". None if the
    option is not a single number (e.g. "No change", "4% decrease" is -> 4 with direction lost, so rejected)."""
    t = _normalise_expr(text)
    t = t.replace("*", "×").replace("(", "").replace(")", "")
    if re.search(r"\b(increase|decrease|gain|loss|profit|more|less|and|or|to|by)\b", t, re.I):
        return None
    nums = _NUM.findall(t)
    if len(nums) != 1:
        m = re.fullmatch(r"\s*(-?\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s*", t)
        return float(m.group(1)) / float(m.group(2)) if m and float(m.group(2)) else None
    rest = t.replace(nums[0], "", 1).strip().rstrip(".").strip().lower()
    if rest and rest not in _UNIT_WORDS and rest not in {"%", "°"} and not re.fullmatch(r"[a-z/²³°. ]{0,12}", rest):
        return None
    n = nums[0].replace(",", "").replace(" ", "")
    if "/" in n:
        a, b = n.split("/")
        return float(a) / float(b) if float(b) else None
    return float(n)


def numbers_in(text: str) -> list[float]:
    out = []
    for n in _NUM.findall(_normalise_expr(text).replace("*", " ")):
        n = n.replace(",", "").replace(" ", "")
        try:
            if "/" in n:
                a, b = n.split("/")
                if float(b):
                    out.append(float(a) / float(b))
                out.extend([float(a), float(b)])
            else:
                out.append(float(n))
        except ValueError:
            continue
    return out


# ── explanation arithmetic ─────────────────────────────────────────────────────
_SEGMENT_SPLIT = re.compile(r"→|=>|;|\n|,\s+|,(?=\s*[a-zA-Z]\s*=)|\.\s+(?=[A-Z])|\b(?:so|then|hence|therefore|thus)\b", re.I)


def _segments(explanation: str) -> list[str]:
    return [s.strip() for s in _SEGMENT_SPLIT.split(explanation or "") if s and s.strip()]


def _assignments(segments: list[str]) -> dict[str, float]:
    """Single-letter variables the working solves for (x = 600, y = 360). A letter assigned two different values is
    ambiguous and dropped."""
    found: dict[str, set[float]] = {}
    for seg in segments:
        for m in re.finditer(r"(?:^|[\s,(])([a-zA-Z])\s*=\s*(-?\d+(?:\.\d+)?)(?![\d./*×(])", seg):
            found.setdefault(m.group(1), set()).add(round(float(m.group(2)), 9))
    return {k: next(iter(v)) for k, v in found.items() if len(v) == 1}


@dataclass
class ArithmeticCheck:
    checked: int = 0                    # equalities actually evaluated on both sides
    errors: list[str] = field(default_factory=list)
    values: list[float] = field(default_factory=list)   # every value the working computed


def check_explanation(explanation: str) -> ArithmeticCheck:
    res = ArithmeticCheck()
    segs = _segments(explanation)
    env = _assignments(segs)
    for seg in segs:
        if "=" not in seg:
            continue
        parts = [p for p in re.split(r"(?<![<>=!])=(?!=)", seg)]
        evaluated = [eval_part(p, env) for p in parts]
        # a bare expression belongs to the unit of the next stated quantity: in "10 m/s = 10 × 18/5 = 36 km/h" the
        # middle term is already km/h, so it is compared with 36 km/h and never with 10 m/s
        for i, q in enumerate(evaluated):
            if q is not None and not q.unit:
                nxt = next((r for r in evaluated[i + 1:] if r is not None and r.unit), None)
                if nxt is not None:
                    q.unit = nxt.unit
        for q in evaluated:
            if q is not None:
                res.values.append(q.value)
        for a, b, pa, pb in zip(evaluated, evaluated[1:], parts, parts[1:]):
            if a is None or b is None:
                continue
            same = _same(a, b)
            if same is None:
                continue
            res.checked += 1
            if not same:
                res.errors.append(f"{pa.strip()} = {pb.strip()}")
    return res


# ── topic solvers (independent of the explanation) ────────────────────────────
def _f(s: str) -> float:
    return float(s.replace(",", ""))


_N = r"(\d[\d,]*(?:\.\d+)?)"
_MONEY = r"(?:₹|rs\.?\s*|\$)?\s*" + _N


def _series_next(terms: list[float]) -> float | None:
    """Next term when the series follows ONE simple rule: constant k-th differences (k<=3) or a constant ratio."""
    if len(terms) < 4:
        return None
    for order in range(1, 4):
        diffs = list(terms)
        for _ in range(order):
            diffs = [b - a for a, b in zip(diffs, diffs[1:])]
        if len(diffs) >= 2 and all(abs(d - diffs[0]) < 1e-9 for d in diffs):
            # rebuild the next term from the difference table
            table = [list(terms)]
            for _ in range(order):
                table.append([b - a for a, b in zip(table[-1], table[-1][1:])])
            nxt = table[-1][-1]
            for row in reversed(table[:-1]):
                nxt = row[-1] + nxt
            return nxt
    if all(t != 0 for t in terms):
        ratios = [b / a for a, b in zip(terms, terms[1:])]
        if all(abs(r - ratios[0]) < 1e-9 for r in ratios):
            return terms[-1] * ratios[0]
    return None


def solve(question: str, topic: str = "") -> float | None:
    """Independent answer for recognisable question shapes, else None."""
    q = " ".join((question or "").replace("−", "-").split())
    ql = q.lower()

    m = re.search(r"what is " + _N + r"\s*% of " + _MONEY + r"\s*\??$", ql)
    if m:
        return _f(m.group(1)) * _f(m.group(2)) / 100
    m = re.search(_MONEY + r" (?:is )?(increased|decreased) by " + _N + r"\s*%", ql)
    if m and re.search(r"(new|resulting|final|becomes|what is the)", ql) and "then" not in ql:
        base, pct = _f(m.group(1)), _f(m.group(3))
        return base * (1 + pct / 100) if m.group(2) == "increased" else base * (1 - pct / 100)
    m = re.search(r"simple interest (?:on|for) " + _MONEY + r" (?:at|@) " + _N + r"\s*% (?:per annum|p\.?a\.?|per year)?\s*(?:for) " + _N + r" years?", ql)
    if m and "amount" not in ql:
        return _f(m.group(1)) * _f(m.group(2)) * _f(m.group(3)) / 100
    m = re.search(r"compound interest (?:on|for) " + _MONEY + r" (?:at|@) " + _N + r"\s*% (?:per annum|p\.?a\.?|per year)?\s*(?:for) " + _N + r" years?", ql)
    if m and ("annually" in ql or "compounded" not in ql) and "half" not in ql and "quarter" not in ql:
        p, r, t = _f(m.group(1)), _f(m.group(2)), _f(m.group(3))
        return p * ((1 + r / 100) ** t - 1)
    m = re.search(r"\ba (?:alone )?can (?:do|finish|complete) (?:a|the|a piece of) (?:piece of )?work in " + _N +
                  r" days?(?:,)? and b (?:alone )?(?:can do it |can finish it |can complete it )?in " + _N + r" days?", ql)
    if m and re.search(r"together|working together|both", ql) and not re.search(r"\bc\b|leaves|left|after", ql):
        a, b = _f(m.group(1)), _f(m.group(2))
        return a * b / (a + b)
    m = re.search(r"(?:travels|covers) " + _N + r" km in " + _N + r" hours?\.? (?:what is )?(?:its|his|her|the) (?:average )?speed", ql)
    if m:
        return _f(m.group(1)) / _f(m.group(2))
    m = re.search(r"train " + _N + r" m(?:etres|eters)? long (?:crosses|passes) a (?:pole|post|signal post|tree|man standing[^.]*?) in " + _N + r" s(?:ec(?:ond)?s?)?", ql)
    if m and "km/h" in ql and "platform" not in ql and "running" not in ql:
        return _f(m.group(1)) / _f(m.group(2)) * 3.6
    m = re.search(r"average of (?:the numbers |the following numbers:? )?((?:-?\d+(?:\.\d+)?\s*,\s*)+(?:and\s+)?-?\d+(?:\.\d+)?)\s*(?:is|\?|$)", ql)
    if m:
        vals = [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", m.group(1))]
        return sum(vals) / len(vals)
    m = re.search(r"(?:buys|bought|purchases|purchased) (?:an? \w+(?: \w+)? )?(?:for|at) " + _MONEY + r"(?: and| ,)? (?:sells|sold) it (?:for|at) " + _MONEY, ql)
    if m and re.search(r"(profit|gain|loss) (?:percent|percentage|%)", ql):
        cp, sp = _f(m.group(1)), _f(m.group(2))
        return abs(sp - cp) / cp * 100
    if topic.lower() in ("number series", "series") or re.search(r"(next|missing) (?:term|number)|what comes next|complete the series", ql):
        seq = re.search(r"((?:-?\d+(?:\.\d+)?\s*,\s*){3,}-?\d+(?:\.\d+)?)\s*,\s*(?:\?|_+|\.\.\.)", q)
        if seq:
            return _series_next([float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", seq.group(1))])
    return None


# ── verdict ────────────────────────────────────────────────────────────────────
@dataclass
class NumericVerdict:
    status: str                                          # verified | contradicted | unverifiable
    reasons: list[str] = field(default_factory=list)
    computed: float | None = None
    method: str = ""                                     # solver | explanation | ""
    details: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.status == "verified"


def option_values(options: list[str]) -> list[float | None]:
    return [parse_number(o) for o in options]


def _matching(values: list[float | None], target: float, decimals: list[int]) -> list[int]:
    return [i for i, v in enumerate(values) if v is not None and close(v, target, decimals[i])]


def verify_numeric_mcq(question: str, options: list[str], answer_index: int, explanation: str, topic: str = "") -> NumericVerdict:
    values = option_values(options)
    decimals = [_decimals_in(o) for o in options]
    if not (0 <= answer_index < len(options)):
        return NumericVerdict("contradicted", ["answer_not_in_options"])

    # numerically identical options (e.g. "0.5" and "1/2") make the key ambiguous
    seen: list[float] = []
    for v, d in zip(values, decimals):
        if v is None:
            continue
        if any(exactly(v, s) for s in seen):
            return NumericVerdict("contradicted", ["duplicate_option_values"])
        seen.append(v)

    ans = values[answer_index]
    solved = solve(question, topic)
    if solved is not None:
        hits = _matching(values, solved, decimals)
        if answer_index in hits:
            return NumericVerdict("verified", [], solved, "solver")
        if hits:
            return NumericVerdict("contradicted", ["solver_matches_other_option"], solved, "solver",
                                  [f"recomputed {round(solved, 4)} = option {hits[0]} ({options[hits[0]]!r}), key says {options[answer_index]!r}"])
        return NumericVerdict("contradicted", ["no_option_matches_solver"], solved, "solver",
                              [f"recomputed {round(solved, 4)}; no option equals it"])

    arith = check_explanation(explanation)
    if arith.errors:
        return NumericVerdict("contradicted", ["explanation_arithmetic_error"], None, "explanation",
                              [f"false equality: {e}" for e in arith.errors[:3]])
    if ans is None:
        return NumericVerdict("unverifiable", ["answer_not_numeric"], None, "", [])

    mentioned = arith.values + numbers_in(explanation)
    supported = any(close(ans, v, decimals[answer_index]) or close(ans, v * 100, decimals[answer_index]) or close(ans * 100, v, 2)
                    for v in mentioned)
    if supported and arith.checked >= 1:
        return NumericVerdict("verified", [], ans, "explanation")
    if arith.values and not supported:
        # Where the working ENDS (its last evaluated value) decides: the key must be the option nearest to it
        # ("147" for 590/4 = 147.5 is a rounded answer; "150" would contradict it).
        final = arith.values[-1]
        dists = sorted((abs(v - final), i) for i, v in enumerate(values) if v is not None)
        if dists:
            dist, nearest = dists[0]
            unique = len(dists) == 1 or dists[1][0] > dist
            near_enough = unique and (dist < 1 if decimals[nearest] == 0 else close(values[nearest], final, decimals[nearest]))
            if near_enough and nearest == answer_index and arith.checked >= 1:
                return NumericVerdict("verified", ["rounded"], final, "explanation")
            if near_enough and nearest != answer_index:
                return NumericVerdict("contradicted", ["explanation_reaches_other_option"], final, "explanation",
                                      [f"working ends at {round(final, 4)} ~ {options[nearest]!r}, key says {options[answer_index]!r}"])
    if not supported:
        return NumericVerdict("unverifiable", ["answer_not_supported_by_explanation"])
    return NumericVerdict("unverifiable", ["no_checkable_arithmetic"])


def is_numeric_question(options: list[str], category: str = "", topic: str = "") -> bool:
    """Quantitative / DI / number-series questions whose options are (mostly) numbers - the ones this module can
    and must verify."""
    vals = option_values(options)
    numeric = sum(v is not None for v in vals)
    return numeric >= max(3, len(options) - 1) and (category in ("Quantitative", "Data Interpretation") or
                                                    topic.lower() in ("number series", "clocks", "calendars") or numeric == len(options))
