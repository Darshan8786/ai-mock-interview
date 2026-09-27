"""
Correct-by-construction aptitude questions (parametric templates) - fully local, no model.

Each template picks "nice" numbers for the requested difficulty, computes the answer with the formula (never parsing
text), writes an explanation whose arithmetic is checkable, and builds distractors from typical mistakes. Every
generated item is ALSO run through numeric_verifier (tests/test_aptitude_templates.py) - two independent code paths
must agree.

Used as (1) the validated offline fallback for quantitative / series questions when the model's candidates are
rejected, and (2) additional verified training examples.

    item = generate("Percentages", "medium", random.Random(7))
    -> {"category","topic","difficulty","question","options":[4],"answer_index","explanation","estimated_time","source":"template"}
"""
from __future__ import annotations

import math
import random
from typing import Callable

DIFFS = ("easy", "medium", "hard")


def fmt(x: float) -> str:
    if abs(x - round(x)) < 1e-9:
        return str(int(round(x)))
    return f"{x:.2f}".rstrip("0").rstrip(".")


def _options(rng: random.Random, answer: float, distractors: list[float], unit_fmt: Callable[[float], str] = fmt) -> tuple[list[str], int]:
    """4 unique options: the answer + 3 distinct plausible wrong values (falls back to +/- offsets)."""
    seen = {unit_fmt(answer)}
    wrong: list[str] = []
    pool = list(distractors)
    step = max(1.0, round(abs(answer) * 0.1))
    k = 1
    while len(pool) < 12:
        pool += [answer + k * step, answer - k * step]
        k += 1
    for d in pool:
        s = unit_fmt(d)
        if d > 0 and s not in seen:
            seen.add(s)
            wrong.append(s)
        if len(wrong) == 3:
            break
    opts = wrong + [unit_fmt(answer)]
    rng.shuffle(opts)
    return opts, opts.index(unit_fmt(answer))


def _pick(rng, easy, medium, hard, difficulty):
    return rng.choice({"easy": easy, "medium": medium, "hard": hard}[difficulty])


# ── Quantitative ───────────────────────────────────────────────────────────────
def percentages(rng, d):
    if d == "easy":
        p, base = rng.choice([10, 20, 25, 30, 40, 50, 75]), rng.choice(range(40, 1001, 20))
        ans = p * base / 100
        q = f"What is {p}% of {base}?"
        exp = f"{base} × {p}/100 = {fmt(ans)}"
        return q, ans, [base * p / 10, ans + p, base - ans], exp, "", 45
    if d == "medium":
        base, p = rng.choice(range(200, 2001, 50)), rng.choice([5, 10, 12, 15, 20, 25, 30])
        up = rng.random() < 0.5
        ans = base * (1 + p / 100) if up else base * (1 - p / 100)
        word = "increased" if up else "decreased"
        q = f"A number {base} is {word} by {p}%. What is the new number?"
        exp = f"{base} × {fmt(1 + p / 100) if up else fmt(1 - p / 100)} = {fmt(ans)}"
        return q, ans, [base * (1 - p / 100) if up else base * (1 + p / 100), base + p if up else base - p, base * p / 100], exp, "", 60
    total = rng.choice(range(2000, 20001, 1000))
    win = rng.choice([52, 55, 58, 60, 62, 65])
    margin = total * (2 * win - 100) / 100
    q = (f"In an election between two candidates, the winner got {win}% of the votes and won by {fmt(margin)} votes. "
         f"How many votes were polled in total?")
    exp = f"Margin = {win}% − {100 - win}% = {2 * win - 100}% of total; total = {fmt(margin)} × 100/{2 * win - 100} = {total}"
    return q, total, [margin * 100 / win, total / 2, margin * 2], exp, "", 75


def profit_loss(rng, d):
    if d == "easy":
        cp = rng.choice(range(100, 1001, 20))
        pct = rng.choice([10, 20, 25, 30, 40, 50])
        sp = cp * (1 + pct / 100)
        q = f"A shopkeeper buys an article for ₹{cp} and sells it for ₹{fmt(sp)}. What is his profit percentage?"
        exp = f"Profit = {fmt(sp)} − {cp} = {fmt(sp - cp)}; profit % = {fmt(sp - cp)}/{cp} × 100 = {pct}%"
        return q, pct, [(sp - cp) / sp * 100, pct / 2, pct + 5], exp, "%", 50
    if d == "medium":
        mp = rng.choice(range(400, 3001, 100))
        disc = rng.choice([10, 15, 20, 25, 30])
        sp = mp * (1 - disc / 100)
        q = f"An article is marked at ₹{mp} and sold at a discount of {disc}%. What is the selling price?"
        exp = f"SP = {mp} × {fmt(1 - disc / 100)} = {fmt(sp)}"
        return q, sp, [mp * disc / 100, mp - disc, mp * (1 + disc / 100)], exp, "₹", 55
    markup, disc = rng.choice([(25, 10), (20, 10), (40, 20), (50, 20), (30, 10), (60, 25)])
    net = (1 + markup / 100) * (1 - disc / 100) * 100 - 100
    q = f"A trader marks his goods {markup}% above the cost price and allows a discount of {disc}%. What is his net profit percentage?"
    exp = (f"SP/CP = {fmt(1 + markup / 100)} × {fmt(1 - disc / 100)} = {fmt(1 + net / 100)}; "
           f"profit % = ({fmt(1 + net / 100)} − 1) × 100 = {fmt(net)}%")
    return q, net, [markup - disc, markup + disc, markup * disc / 100], exp, "%", 75


def simple_interest(rng, d):
    p = rng.choice(range(1000, 20001, 500))
    r = rng.choice([4, 5, 6, 8, 10, 12] if d != "easy" else [5, 10])
    t = rng.choice([2, 3, 4, 5] if d != "hard" else [3, 4, 5, 6])
    si = p * r * t / 100
    if d == "hard":
        amt = p + si
        q = f"A sum of money amounts to ₹{fmt(amt)} in {t} years at {r}% per annum simple interest. What is the sum?"
        exp = f"Amount = P(1 + {r}×{t}/100) = P × {fmt(1 + r * t / 100)}; P = {fmt(amt)}/{fmt(1 + r * t / 100)} = {p}"
        return q, p, [amt - amt * r * t / 100, si, amt / (1 + r / 100)], exp, "₹", 80
    q = f"What is the simple interest on ₹{p} at {r}% per annum for {t} years?"
    exp = f"SI = {p} × {r} × {t}/100 = {fmt(si)}"
    return q, si, [p * r / 100, si + p, p * r * (t + 1) / 100], exp, "₹", 50


def compound_interest(rng, d):
    p = rng.choice(range(1000, 20001, 1000))
    r = rng.choice([10, 20] if d == "easy" else [5, 10, 20])
    t = 2 if d != "hard" else 3
    amt = p * (1 + r / 100) ** t
    ci = amt - p
    q = f"What is the compound interest on ₹{p} at {r}% per annum for {t} years, compounded annually?"
    exp = f"Amount = {p} × {fmt(1 + r / 100)}^{t} = {fmt(amt)}; CI = {fmt(amt)} − {p} = {fmt(ci)}"
    return q, ci, [p * r * t / 100, amt, ci + p * r / 100], exp, "₹", 70 if d != "hard" else 90


def time_work(rng, d):
    pairs = {"easy": [(10, 15), (12, 24), (6, 12), (20, 30), (15, 30)],
             "medium": [(12, 18), (18, 36), (24, 40), (20, 60), (14, 21)],
             "hard": [(15, 20), (24, 36), (40, 60), (21, 28), (30, 45)]}
    a, b = rng.choice(pairs[d])
    together = a * b / (a + b)
    if d == "hard":
        x = rng.choice([2, 3, 4])
        while x >= together:
            x -= 1
        remaining = 1 - x * (1 / a + 1 / b)
        ans = remaining * a
        q = (f"A can do a piece of work in {a} days and B in {b} days. They work together for {x} days, after which B "
             f"leaves. In how many more days will A finish the remaining work?")
        exp = (f"Work done together in {x} days = {x} × (1/{a} + 1/{b}) = {fmt(x * (1 / a + 1 / b))}; remaining = "
               f"{fmt(remaining)}; A needs {fmt(remaining)} × {a} = {fmt(ans)} days")
        return q, ans, [ans + x, remaining * b, together], exp, " days", 110
    q = f"A can do a piece of work in {a} days and B in {b} days. Working together, in how many days will they finish it?"
    exp = f"Together = {a} × {b}/({a} + {b}) = {a * b}/{a + b} = {fmt(together)}"
    return q, together, [(a + b) / 2, a + b, abs(b - a)], exp, " days", 60


def pipes(rng, d):
    fill, empty = rng.choice({"easy": [(6, 12), (8, 24), (10, 15), (12, 36)],
                              "medium": [(8, 12), (10, 12), (6, 9), (12, 20)],
                              "hard": [(15, 20), (9, 12), (14, 21), (16, 24)]}[d])
    ans = fill * empty / (empty - fill)
    q = (f"A pipe can fill a tank in {fill} hours and another pipe can empty the full tank in {empty} hours. "
         f"If both are opened together, in how many hours will the empty tank be filled?")
    exp = f"Net rate = 1/{fill} − 1/{empty} = 1/{fmt(ans)}; time = {fill} × {empty}/({empty} − {fill}) = {fmt(ans)}"
    return q, ans, [fill * empty / (fill + empty), empty - fill, (fill + empty) / 2], exp, " hours", 60 if d == "easy" else 75


def speed(rng, d):
    if d == "easy":
        spd, t = rng.choice([40, 45, 50, 60, 72, 80]), rng.choice([2, 3, 4, 5])
        q = f"A car travels {spd * t} km in {t} hours. What is its speed in km/h?"
        exp = f"Speed = {spd * t}/{t} = {spd}"
        return q, spd, [spd * t / (t + 1), spd + 10, spd * 2], exp, " km/h", 35
    if d == "medium":
        ms = rng.choice([10, 15, 20, 25, 30])
        t = rng.choice([8, 10, 12, 15, 18])
        length = ms * t
        kmh = ms * 3.6
        q = f"A train {length} m long crosses a pole in {t} seconds. What is its speed in km/h?"
        exp = f"Speed = {length}/{t} = {ms} m/s = {ms} × 18/5 = {fmt(kmh)} km/h"
        return q, kmh, [ms, ms * 5 / 18, kmh + 18], exp, "", 60
    a, b = rng.choice([(40, 60), (30, 60), (60, 90), (36, 45), (45, 90), (20, 30)])
    avg = 2 * a * b / (a + b)
    q = (f"A person travels from P to Q at {a} km/h and returns from Q to P at {b} km/h. What is the average speed for "
         f"the whole journey in km/h?")
    exp = f"Average speed = 2 × {a} × {b}/({a} + {b}) = {2 * a * b}/{a + b} = {fmt(avg)}"
    return q, avg, [(a + b) / 2, abs(b - a), a * b / (a + b)], exp, "", 70


def boats(rng, d):
    boat, stream = rng.choice({"easy": [(8, 2), (10, 2), (12, 3), (9, 3)],
                               "medium": [(15, 3), (14, 4), (18, 2), (20, 5)],
                               "hard": [(11, 3), (13, 5), (16, 4), (22, 6)]}[d])
    if d == "easy":
        up = boat - stream
        dist = up * rng.choice([2, 3, 4, 5])
        ans = dist / up
        q = f"The speed of a boat in still water is {boat} km/h and the speed of the stream is {stream} km/h. How many hours will it take to go {dist} km upstream?"
        exp = f"Upstream speed = {boat} − {stream} = {up}; time = {dist}/{up} = {fmt(ans)}"
        return q, ans, [dist / (boat + stream), dist / boat, ans + 1], exp, " hours", 50
    down, up = boat + stream, boat - stream
    q = f"A man rows downstream at {down} km/h and upstream at {up} km/h. What is the speed of the stream in km/h?"
    exp = f"Stream speed = ({down} − {up})/2 = {fmt(stream)}"
    return q, stream, [boat, down - up, (down + up) / 4], exp, "", 45


def averages(rng, d):
    n = {"easy": 4, "medium": 5, "hard": 6}[d]
    avg = rng.choice(range(20, 90, 2))
    vals = [avg + rng.choice(range(-12, 13, 2)) for _ in range(n - 1)]
    vals.append(avg * n - sum(vals))
    if d == "hard":
        n2 = n + 1
        new_avg = avg + rng.choice([1, 2, 3])
        added = new_avg * n2 - avg * n
        q = f"The average age of {n} members of a team is {avg} years. When the coach joins, the average becomes {new_avg} years. What is the coach's age?"
        exp = f"Total with coach = {n2} × {new_avg} = {new_avg * n2}; without = {n} × {avg} = {avg * n}; coach = {new_avg * n2} − {avg * n} = {added}"
        return q, added, [new_avg, added - n, new_avg + n], exp, " years", 70
    q = f"What is the average of {', '.join(str(v) for v in vals[:-1])} and {vals[-1]}?"
    exp = f"({' + '.join(str(v) for v in vals)})/{n} = {sum(vals)}/{n} = {fmt(avg)}"
    return q, avg, [sum(vals) / (n - 1), avg + 2, avg - 2], exp, "", 45


def ratio(rng, d):
    a, b = rng.choice([(2, 3), (3, 5), (4, 7), (5, 7), (3, 4), (5, 9), (7, 11)])
    k = rng.choice(range(3, 25))
    total = (a + b) * k
    if d == "hard":
        c = rng.choice([2, 3, 4, 6])
        q = f"Three partners share ₹{(a + b + c) * k * 10} in the ratio {a}:{b}:{c}. What is the share of the second partner?"
        ans = b * k * 10
        exp = f"Parts = {a} + {b} + {c} = {a + b + c}; share = {(a + b + c) * k * 10} × {b}/{a + b + c} = {ans}"
        return q, ans, [a * k * 10, c * k * 10, (a + b + c) * k * 10 / 3], exp, "₹", 60
    q = f"Two numbers are in the ratio {a}:{b} and their sum is {total}. What is the larger number?"
    exp = f"{a + b} parts = {total}; one part = {total}/{a + b} = {k}; larger = {b} × {k} = {b * k}"
    return q, b * k, [a * k, total - a, k * (b - a)], exp, "", 45 if d == "easy" else 55


def ages(rng, d):
    son = rng.choice(range(6, 20))
    m = rng.choice([2, 3, 4])
    father = m * son
    if d == "easy":
        q = f"The sum of the ages of a father and his son is {father + son} years. The father is {m} times as old as the son. What is the son's age?"
        exp = f"son + {m} × son = {father + son} → son = {father + son}/{m + 1} = {son}"
        return q, son, [father, son + m, (father + son) / m], exp, " years", 50
    for yrs in range(2, 30):
        if (father + yrs) % (son + yrs) == 0 and (father + yrs) // (son + yrs) < m:
            m2 = (father + yrs) // (son + yrs)
            break
    else:
        return ages(rng, "easy")
    q = (f"A father is {m} times as old as his son. After {yrs} years, he will be {m2} times as old as his son. "
         f"What is the son's present age?")
    exp = f"{m}x + {yrs} = {m2}(x + {yrs}) → x = {yrs}({m2} − 1)/({m} − {m2}) = {son}"
    return q, son, [father, son + yrs, son * m2], exp, " years", 90


def hcf_lcm(rng, d):
    h = rng.choice([2, 3, 4, 5, 6, 8, 12])
    a, b = rng.choice([(2, 3), (3, 4), (3, 5), (4, 5), (5, 7), (2, 9), (7, 9)])
    x, y = h * a, h * b
    lcm = h * a * b
    if d == "easy":
        q = f"What is the HCF of {x} and {y}?"
        exp = f"{x} = {h} × {a}, {y} = {h} × {b}; HCF = {h}"
        return q, h, [lcm, h * a, h * 2], exp, "", 40
    prod = x * y
    q = f"The product of two numbers is {prod} and their HCF is {h}. What is their LCM?"
    exp = f"LCM = product/HCF = {prod}/{h} = {lcm}"
    return q, lcm, [prod / (h * 2), lcm + h, prod / lcm], exp, "", 45


def probability(rng, d):
    if d == "easy":
        target = rng.choice(["an even number", "a number greater than 4", "a prime number", "a multiple of 3"])
        fav = {"an even number": 3, "a number greater than 4": 2, "a prime number": 3, "a multiple of 3": 2}[target]
        q = f"A fair die is rolled once. What is the probability of getting {target}?"
        g = math.gcd(fav, 6)
        exp = f"Favourable outcomes = {fav}, total = 6; P = {fav}/6 = {fav // g}/{6 // g}"
        ans = fav / 6
        return q, ans, [fav / 5, 1 - ans + 1 / 6, 1 / 6], exp, "frac", 40
    if d == "medium":
        s = rng.choice([4, 5, 6, 7, 8, 9, 10])
        ways = sum(1 for i in range(1, 7) for j in range(1, 7) if i + j == s)
        g = math.gcd(ways, 36)
        q = f"Two fair dice are rolled together. What is the probability that the sum is {s}?"
        exp = f"Pairs with sum {s} = {ways}, total outcomes = 36; P = {ways}/36 = {ways // g}/{36 // g}"
        return q, ways / 36, [ways / 12, (ways + 1) / 36, 1 / 6 if ways != 6 else 5 / 36], exp, "frac", 60
    r, b = rng.choice([(3, 5), (4, 6), (5, 3), (2, 6), (4, 4), (5, 5)])
    n = r + b
    fav, tot = r * (r - 1) // 2, n * (n - 1) // 2
    g = math.gcd(fav, tot)
    q = f"A bag contains {r} red and {b} blue balls. Two balls are drawn at random without replacement. What is the probability that both are red?"
    exp = f"P = C({r},2)/C({n},2) = {fav}/{tot} = {fav // g}/{tot // g}"
    return q, fav / tot, [(r / n) ** 2, r / n, fav / (tot + n)], exp, "frac", 90


def perm_comb(rng, d):
    if d == "easy":
        n = rng.choice([4, 5, 6])
        ans = math.factorial(n)
        q = f"In how many ways can {n} different books be arranged in a row on a shelf?"
        exp = f"{n}! = {' × '.join(str(i) for i in range(n, 0, -1))} = {ans}"
        return q, ans, [n * n, math.factorial(n - 1), ans // 2], exp, "", 40
    if d == "medium":
        n, r = rng.choice([(6, 2), (7, 3), (8, 2), (9, 3), (10, 2), (6, 3)])
        ans = math.comb(n, r)
        q = f"In how many ways can a committee of {r} be chosen from {n} people?"
        exp = f"C({n},{r}) = {' × '.join(str(n - i) for i in range(r))}/{math.factorial(r)} = {ans}"
        return q, ans, [math.perm(n, r), n * r, math.comb(n, r - 1) if r > 1 else n + 1], exp, "", 55
    word = rng.choice(["LETTER", "BANANA", "APPLE", "COFFEE", "BALLOON", "SUCCESS"])
    counts = {c: word.count(c) for c in dict.fromkeys(word)}
    denom = math.prod(math.factorial(v) for v in counts.values())
    ans = math.factorial(len(word)) // denom
    reps = " × ".join(f"{v}!" for v in counts.values() if v > 1)
    q = f"How many distinct arrangements can be made of the letters of the word {word}?"
    exp = f"{len(word)}!/({reps}) = {math.factorial(len(word))}/{denom} = {ans}"
    return q, ans, [math.factorial(len(word)), ans * 2, ans // 2], exp, "", 75


def partnership(rng, d):
    a_inv, b_inv = rng.choice([(3000, 5000), (4000, 6000), (5000, 7000), (6000, 9000), (8000, 12000)])
    ta, tb = (12, 12) if d == "easy" else rng.choice([(12, 8), (12, 6), (9, 12), (12, 9)])
    ra, rb = a_inv * ta, b_inv * tb
    g = math.gcd(ra, rb)
    parts = (ra + rb) // g
    profit = parts * rng.choice(range(100, 1001, 100))
    share_b = profit * (rb // g) // parts
    q = (f"A invests ₹{a_inv} for {ta} months and B invests ₹{b_inv} for {tb} months in a business. Out of a total "
         f"profit of ₹{profit}, what is B's share?")
    exp = f"Ratio = {a_inv}×{ta} : {b_inv}×{tb} = {ra // g}:{rb // g}; B = {profit} × {rb // g}/{parts} = {share_b}"
    return q, share_b, [profit - share_b, profit * b_inv / (a_inv + b_inv), profit / 2], exp, "₹", 75


# ── Logical reasoning (numeric) ────────────────────────────────────────────────
def number_series(rng, d):
    if d == "easy":
        a, step = rng.choice(range(2, 20)), rng.choice(range(3, 12))
        terms = [a + i * step for i in range(6)]
        rule = f"add {step} each time"
    elif d == "medium":
        a, r = rng.choice([2, 3, 4, 5]), rng.choice([2, 3])
        terms = [a * r ** i for i in range(6)]
        rule = f"multiply by {r} each time"
    else:
        a, s, inc = rng.choice(range(1, 10)), rng.choice(range(2, 6)), rng.choice([2, 3, 4])
        terms = [a]
        for i in range(5):
            terms.append(terms[-1] + s + i * inc)
        rule = f"the differences increase by {inc} ({', '.join(str(terms[i + 1] - terms[i]) for i in range(5))})"
    shown, ans = terms[:5], terms[5]
    q = f"Find the next term in the series: {', '.join(str(t) for t in shown)}, ?"
    exp = f"Rule: {rule}; next term = {shown[-1]} + {ans - shown[-1]} = {ans}" if d != "medium" else f"Rule: {rule}; next term = {shown[-1]} × {ans // shown[-1]} = {ans}"
    return q, ans, [ans + (terms[5] - terms[4]), ans - 1, shown[-1] * 2 if d != "medium" else ans + shown[-1]], exp, "", 45


TEMPLATES: dict[str, tuple[str, Callable]] = {
    "Percentages": ("Quantitative", percentages),
    "Profit Loss & Discount": ("Quantitative", profit_loss),
    "Simple Interest": ("Quantitative", simple_interest),
    "Compound Interest": ("Quantitative", compound_interest),
    "Time & Work": ("Quantitative", time_work),
    "Pipes & Cisterns": ("Quantitative", pipes),
    "Time Speed & Distance": ("Quantitative", speed),
    "Boats & Streams": ("Quantitative", boats),
    "Averages": ("Quantitative", averages),
    "Ratio & Proportion": ("Quantitative", ratio),
    "Problems on Ages": ("Quantitative", ages),
    "HCF & LCM": ("Quantitative", hcf_lcm),
    "Probability": ("Quantitative", probability),
    "Permutation & Combination": ("Quantitative", perm_comb),
    "Partnership": ("Quantitative", partnership),
    "Number Series": ("Logical Reasoning", number_series),
}


def _render(value: float, unit: str) -> str:
    if unit == "frac":
        from fractions import Fraction
        f = Fraction(value).limit_denominator(1000)
        return f"{f.numerator}/{f.denominator}"
    if unit == "₹":
        return f"₹{fmt(value)}"
    if unit == "%":
        return f"{fmt(value)}%"
    return f"{fmt(value)}{unit}"


def supported_topics() -> list[str]:
    return list(TEMPLATES)


def generate(topic: str, difficulty: str = "medium", rng: random.Random | None = None) -> dict | None:
    """One verified-by-construction MCQ for `topic` (catalog name), or None if no template covers it."""
    if topic not in TEMPLATES:
        return None
    rng = rng or random.Random()
    difficulty = difficulty if difficulty in DIFFS else "medium"
    category, fn = TEMPLATES[topic]
    question, answer, distractors, explanation, unit, seconds = fn(rng, difficulty)
    options, idx = _options(rng, answer, distractors, lambda v: _render(v, unit))
    return {"category": category, "topic": topic, "difficulty": difficulty, "question": question, "options": options,
            "answer_index": idx, "answer": options[idx], "explanation": explanation, "estimated_time": seconds,
            "source": "template"}
