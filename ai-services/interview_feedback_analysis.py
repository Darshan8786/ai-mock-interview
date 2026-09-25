"""
Explainable answer analysis for the mock-interview module.

Everything here is local, deterministic text/number analysis - no network call,
no LLM, no API key. It EXTENDS local_answer_evaluator.evaluate_answer(): the
evaluator keeps producing the original six scores, and this module turns the
same intermediate measurements (matched/missing concepts, hedging, fillers,
sentence structure, ...) plus the answer text into:

  * four extra scores  - structure, completeness, clarity, conciseness
  * answer-structure analysis (chosen per question type, never one-size-fits-all)
  * communication analysis (only metrics that can actually be measured)
  * an answer-quality timeline
  * a "why this score?" explanation per metric
  * strengths / weaknesses / improvement actions / practice topics

Honesty rules (enforced by construction):
  * Every reason quotes something measured from the candidate's own answer, the
    question's expected concepts, or audio metadata sent by the client.
  * A metric that cannot be measured is None ("Not available" in the UI). Audio
    timings (duration, speaking rate, pauses) exist ONLY when the client sent
    real recording measurements; a typed answer never gets a speaking rate.
  * Timeline events carry `position` (fraction of the transcript's words) which
    is real; `atSeconds` is set only for audio-measured pauses. Nothing is
    interpolated into fake timestamps.
  * Structure detection is cue-based (transparent keyword/phrase patterns). It
    tells the candidate what the answer visibly contains, not whether it is
    correct - the technical score covers correctness.
"""

import re

ANALYSIS_VERSION = 2

# --------------------------------------------------------------------------
# Question typing
# --------------------------------------------------------------------------

_SITUATIONAL_CUES = re.compile(
    r"\b(tell me about a time|describe a (time|situation)|give (me )?an example|"
    r"a time (when|you)|situation|conflict|disagree|failure|mistake|challenge you|"
    r"how (did|do) you (handle|deal|manage|cope|prioriti[sz]e)|handled|dealt with|"
    r"under pressure|tight deadline|leadership|led a|worked (in|on) a team|teamwork)\b",
    re.I,
)
_PROJECT_CUES = re.compile(
    r"\b(your (final year |college |personal |team |capstone )?(project|application|app|system|product)|"
    r"project you|the project|projects? (you|that you))\b",
    re.I,
)

STRUCTURE_TYPES = {
    "technical": {
        "label": "Technical explanation",
        "framework": "Definition → Explanation → Example → Conclusion",
        "recommendation": (
            "Open with a one-line definition, explain how or why it works, give a short concrete "
            "example, then close with a one-sentence takeaway."
        ),
    },
    "behavioral": {
        "label": "Situation-based (STAR)",
        "framework": "Situation → Task → Action → Result",
        "recommendation": (
            "Set the scene in a sentence, state your task, describe what YOU did step by step, "
            "and finish with the measurable result or what you learned."
        ),
    },
    "project": {
        "label": "Project explanation",
        "framework": "Problem → Technology → Implementation → Your contribution → Result",
        "recommendation": (
            "Start with the problem, explain your implementation, then clearly state your "
            "contribution and result."
        ),
    },
    "hr": {
        "label": "Opinion / motivation answer",
        "framework": "Direct answer → Reason → Example → Link to the role",
        "recommendation": (
            "Answer the question directly first, give the reason behind it, support it with a "
            "specific example, and tie it back to the role you are interviewing for."
        ),
    },
}

# Ideal answer length (words) per structure type: (lower, upper).
_LENGTH_RANGE = {
    "technical": (35, 160),
    "behavioral": (70, 220),
    "project": (60, 220),
    "hr": (40, 180),
}


def classify_question(question: str, interview_type: str, skill: str = "") -> str:
    if skill == "Project":
        return "project"
    if interview_type == "Behavioral":
        return "behavioral"
    if interview_type == "HR":
        return "behavioral" if _SITUATIONAL_CUES.search(question or "") else "hr"
    if _PROJECT_CUES.search(question or ""):
        return "project"
    return "technical"


# --------------------------------------------------------------------------
# Structure cues
# --------------------------------------------------------------------------

_EXAMPLE_CUE = (
    r"\b(for example|for instance|e\.g\.?|such as|consider|suppose|imagine|let'?s say|"
    r"in my (project|experience|internship|college)|i (used|built|worked|implemented|applied)|"
    r"an example|one example|say you)\b|select .+ from|\bdef \w+|\bfor \(|\w+\(.*\)"
)
_CUES = {
    "technical": [
        ("definition", "Definition", 0.25, r"\b(is|are) (a|an|the|used|defined|basically|essentially|known)\b|\brefers? to\b|\bdefined as\b|\bstands? for\b|\bmeans?\b|\bis known as\b", "any"),
        ("explanation", "Explanation", 0.35, r"\b(because|since|works? by|so that|which (means|allows|helps|ensures)|this (means|allows|ensures|helps)|as a result|due to|in order to|by (using|doing|ensuring)|first|then|next|how)\b", "any"),
        ("example", "Example", 0.25, _EXAMPLE_CUE, "any"),
        ("conclusion", "Conclusion", 0.15, r"\b(in summary|in conclusion|to summari[sz]e|to sum up|overall|in short|in essence|that'?s why|this is why|to conclude|in a nutshell|so basically|therefore|thus|hence)\b", "last"),
    ],
    "behavioral": [
        ("situation", "Situation", 0.2, r"\b(when i|while i|in my (previous|last|final|college|internship|first|team|project|class)|during (my|the|a|an)|at (my|the) (college|company|internship)|last (year|semester|month)|once\b|there was (a|an)|we had|our team|i was (working|part|in|a)|in our (team|project|class|college))\b", "any"),
        ("task", "Task", 0.2, r"\b(my (task|role|responsibility|goal|job)|i was (responsible|assigned|tasked|asked|supposed|expected|required)|i (needed|had|have) to|the goal was|the objective|our goal|we needed|assigned)\b", "any"),
        ("action", "Action", 0.3, r"\b(i|we) (decided|implemented|built|created|led|started|worked|organi[sz]ed|developed|designed|wrote|fixed|analy[sz]ed|proposed|took|talked|discussed|reached|asked|handled|managed|coordinated|planned|set up|reviewed|tested|researched|divided|prioriti[sz]ed|communicated|explained|listened)\b", "any"),
        ("result", "Result", 0.3, r"\b(as a result|resulted|the (result|outcome)|in the end|finally|eventually|we (achieved|delivered|completed|managed|succeeded|won|reduced|improved|increased)|which (led|helped|improved|reduced|increased)|improved|reduced|increased|successfully|learned|learnt|lesson|\d+ ?%)\b", "any"),
    ],
    "project": [
        ("problem", "Problem", 0.2, r"\b(problem|challenge|goal|aim|aimed|needed|to solve|purpose|issue|objective|motivation|pain point|wanted to)\b", "any"),
        ("technology", "Technology", 0.15, r"\b(using|built with|tech stack|framework|library|database|language|react|node|python|java|javascript|typescript|mongodb|sql|mysql|postgres|django|flask|spring|angular|vue|express|docker|aws|firebase|tensorflow|pytorch|api)\b", "any"),
        ("implementation", "Implementation", 0.25, r"\b(implemented|designed|architecture|module|backend|frontend|front end|back end|integrated|endpoint|algorithm|schema|pipeline|component|service|workflow|structured|deployed|developed)\b", "any"),
        ("contribution", "Your contribution", 0.2, r"\b(i (was responsible|developed|built|implemented|designed|wrote|created|handled|worked on|led|managed|took care)|my (role|contribution|part|responsibility)|i was (in charge|the one|responsible))\b", "any"),
        ("result", "Result", 0.2, r"\b(result|outcome|achieved|improved|reduced|increased|deployed|users|accuracy|performance|successfully|learned|delivered|completed|\d+ ?%)\b", "any"),
    ],
    "hr": [
        ("answer", "Direct answer", 0.3, None, "first"),
        ("reason", "Reason", 0.3, r"\b(because|since|reason|that'?s why|which is why|due to|as i|so that|this is why)\b", "any"),
        ("example", "Example", 0.25, _EXAMPLE_CUE + r"|\b(when i|in my (last|previous|college|internship|team|project))\b", "any"),
        ("role", "Link to the role", 0.15, r"\b(role|position|company|team|organi[sz]ation|this job|contribut|fit|value|opportunity|grow|responsibilit|career)\w*\b", "any"),
    ],
}


def _split_sentences(text: str) -> list:
    parts = re.split(r"(?<=[.!?])\s+|\n+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def _clip(value: float, lo: int = 0, hi: int = 100) -> int:
    return int(max(lo, min(hi, round(value))))


def _snippet(sentence: str, limit: int = 110) -> str:
    sentence = " ".join(sentence.split())
    return sentence if len(sentence) <= limit else sentence[: limit - 1].rstrip() + "…"


def _window(sentence: str, start: int, end: int, before: int = 40, after: int = 70) -> str:
    """Evidence text centred on the cue that matched, taken from the candidate's own words."""
    lo = max(0, start - before)
    hi = min(len(sentence), end + after)
    text = " ".join(sentence[lo:hi].split())
    return ("…" if lo > 0 else "") + text + ("…" if hi < len(sentence) else "")


def analyze_structure(question_type: str, sentences: list, word_count: int, sentence_word_starts: list) -> dict:
    spec = STRUCTURE_TYPES[question_type]
    elements = []
    score = 0.0
    total_weight = 0.0

    def find(pattern: str, scope: str):
        """(evidence, position) of the first cue match, or None. Positions are word-based so they
        stay meaningful for voice transcripts that carry no punctuation."""
        regex = re.compile(pattern, re.I)
        hit = None
        for i, sentence in enumerate(sentences):
            for m in regex.finditer(sentence):
                pos = (sentence_word_starts[i] + len(sentence[: m.start()].split())) / max(word_count, 1)
                if scope == "last" and pos < 0.65:
                    continue
                cand = (_window(sentence, m.start(), m.end()), round(pos, 3))
                if scope == "last":
                    hit = cand  # keep the latest match near the end
                else:
                    return cand
        return hit

    for key, label, weight, pattern, scope in _CUES[question_type]:
        total_weight += weight
        hit = None
        if key == "answer" and question_type == "hr":
            # Direct answer: the opening sentence makes a statement instead of stalling or asking back.
            if sentences and len(sentences[0].split()) >= 4 and not sentences[0].rstrip().endswith("?"):
                hit = (_snippet(sentences[0]), 0.0)
        else:
            hit = find(pattern, scope)

        found = hit is not None
        if found:
            score += weight
        elements.append(
            {
                "key": key,
                "label": label,
                "found": found,
                "evidence": hit[0] if found else "",
                "position": hit[1] if found else None,
            }
        )

    structure_score = _clip(score / total_weight * 100) if total_weight else 0
    if word_count < 8:
        structure_score = min(structure_score, 20)  # too little text to show any structure

    missing = [e["label"] for e in elements if not e["found"]]
    recommendation = spec["recommendation"]
    if missing:
        recommendation += " Your answer did not clearly include: " + ", ".join(missing) + "."

    return {
        "type": question_type,
        "label": spec["label"],
        "framework": spec["framework"],
        "score": structure_score,
        "elements": elements,
        "missing": missing,
        "recommendation": recommendation,
    }


# --------------------------------------------------------------------------
# Communication
# --------------------------------------------------------------------------

_MIN_RATE_SECONDS = 8.0
_MIN_RATE_WORDS = 10
LONG_PAUSE_SECONDS = 2.0


def _fmt_seconds(seconds: float) -> str:
    seconds = int(round(seconds))
    return f"{seconds // 60}m {seconds % 60:02d}s" if seconds >= 60 else f"{seconds}s"


def sanitize_speech(speech) -> dict:
    """Client-supplied audio measurements -> safe numbers, or {} when unusable."""
    if not isinstance(speech, dict):
        return {}

    def num(v, lo, hi):
        try:
            f = float(v)
        except (TypeError, ValueError):
            return None
        if f != f or f < lo or f > hi:
            return None
        return f

    recording = num(speech.get("recordingSeconds"), 0.5, 3600)
    if recording is None:
        return {}
    out = {"recordingSeconds": recording}
    speaking = num(speech.get("speechSeconds"), 0, recording + 1)
    if speaking is not None:
        out["speechSeconds"] = speaking
    pauses = speech.get("pauses")
    if isinstance(pauses, list) and speech.get("pauseDetection") is True:
        clean = []
        for p in pauses[:50]:
            if not isinstance(p, dict):
                continue
            start = num(p.get("startSeconds"), 0, recording + 1)
            dur = num(p.get("durationSeconds"), 0.1, recording + 1)
            if start is not None and dur is not None:
                clean.append({"startSeconds": round(start, 1), "durationSeconds": round(dur, 1)})
        out["pauses"] = clean  # present (possibly empty) => pause detection actually ran
    return out


def find_repeats(tokens: list, stopwords: set) -> list:
    """Immediate word repeats ("the the") and 3-word phrases said 2+ times."""
    found = []
    for i in range(1, len(tokens)):
        if tokens[i] == tokens[i - 1] and tokens[i] not in ("that", "had"):
            found.append({"text": f"{tokens[i]} {tokens[i]}", "position_index": i})
    seen = {}
    for i in range(len(tokens) - 2):
        gram = tuple(tokens[i : i + 3])
        if all(t in stopwords for t in gram):
            continue
        if gram in seen:
            found.append({"text": " ".join(gram), "position_index": i})
        else:
            seen[gram] = i
    # de-duplicate by text, keep the first occurrence
    unique, texts = [], set()
    for f in found:
        if f["text"] not in texts:
            texts.add(f["text"])
            unique.append(f)
    return unique


def analyze_communication(
    answer: str,
    tokens: list,
    question_type: str,
    filler_tokens: list,
    repeats: list,
    hedges_found: list,
    answer_type: str,
    speech: dict,
    time_taken: float,
    main_point_late: bool,
) -> dict:
    word_count = len(tokens)
    lower, upper = _LENGTH_RANGE[question_type]
    notes = []

    filler_counts = {}
    for t in filler_tokens:
        filler_counts[t] = filler_counts.get(t, 0) + 1
    fillers = {
        "count": len(filler_tokens),
        "items": [{"word": w, "count": c} for w, c in sorted(filler_counts.items(), key=lambda x: -x[1])],
    }

    duration = None
    duration_source = None
    if speech.get("recordingSeconds"):
        duration = round(speech["recordingSeconds"], 1)
        duration_source = "recording"
    elif time_taken and time_taken > 0:
        duration = float(time_taken)
        duration_source = "time_on_question"

    speaking_rate = None
    if (
        answer_type == "voice"
        and speech.get("recordingSeconds")
        and speech["recordingSeconds"] >= _MIN_RATE_SECONDS
        and word_count >= _MIN_RATE_WORDS
    ):
        wpm = round(word_count / (speech["recordingSeconds"] / 60.0))
        speaking_rate = {"wpm": wpm, "label": "Slow" if wpm < 110 else "Fast" if wpm > 170 else "Normal"}

    long_pauses = None
    if answer_type == "voice" and "pauses" in speech:
        items = [p for p in speech["pauses"] if p["durationSeconds"] >= LONG_PAUSE_SECONDS]
        long_pauses = {
            "count": len(items),
            "totalSeconds": round(sum(p["durationSeconds"] for p in items), 1),
            "thresholdSeconds": LONG_PAUSE_SECONDS,
            "items": items,
        }

    if word_count < 10:
        length = "extremely_short"
    elif word_count < lower:
        length = "short"
    elif word_count > upper:
        length = "long"
    else:
        length = "appropriate"

    if answer_type == "voice":
        notes.append(
            "Filler words are counted from the transcript; speech recognition often leaves out "
            "'um'/'uh', so the real number may be higher."
        )

    # One plain-English coaching sentence, assembled only from measured facts.
    parts = []
    if length == "extremely_short":
        parts.append(f"Your answer was extremely short ({word_count} words) - there is not enough to judge depth or structure.")
    elif length == "short":
        parts.append(f"Your answer was short for this kind of question ({word_count} words; aim for roughly {lower}-{upper}).")
    elif length == "long":
        parts.append(f"Your answer ran long ({word_count} words; roughly {lower}-{upper} is usually enough).")
    if main_point_late:
        parts.append("You took too long to reach the main point - lead with the direct answer, then add detail.")
    if fillers["count"] >= 3:
        parts.append(f"You used {fillers['count']} filler words.")
    if repeats:
        parts.append("You repeated some phrases (" + ", ".join(f'"{r["text"]}"' for r in repeats[:2]) + ").")
    if hedges_found:
        parts.append("Hedging phrases (" + ", ".join(f'"{h}"' for h in hedges_found[:3]) + ") made the answer sound unsure.")
    if long_pauses and long_pauses["count"]:
        parts.append(f"You had {long_pauses['count']} pause(s) of {LONG_PAUSE_SECONDS:.0f}s or longer.")
    if speaking_rate and speaking_rate["label"] != "Normal":
        parts.append(f"Your speaking rate was {speaking_rate['label'].lower()} (about {speaking_rate['wpm']} words/min).")
    flagged = bool(parts)
    if not parts:
        parts.append("Length, fluency and delivery were all within a healthy range for this question.")

    return {
        "wordCount": word_count,
        "durationSeconds": duration,
        "durationSource": duration_source,
        "durationLabel": _fmt_seconds(duration) if duration is not None else None,
        "fillerWords": fillers,
        "repeatedPhrases": {"count": len(repeats), "items": [r["text"] for r in repeats[:6]]},
        "hedgingPhrases": {"count": len(hedges_found), "items": hedges_found[:6]},
        "longPauses": long_pauses,
        "speakingRate": speaking_rate,
        "length": length,
        "idealLength": {"min": lower, "max": upper},
        "feedback": " ".join(parts),
        "flagged": flagged,
        "notes": notes,
    }


# --------------------------------------------------------------------------
# Timeline
# --------------------------------------------------------------------------

def build_timeline(
    structure: dict,
    matched: list,
    concept_positions: dict,
    filler_positions: list,
    repeats: list,
    hedge_positions: list,
    token_count: int,
    communication: dict,
    main_point_late: bool,
    answered_directly: bool,
) -> list:
    events = []

    def pos(idx):
        return round(idx / token_count, 3) if token_count else None

    if answered_directly:
        events.append({"kind": "good", "label": "Answered the question directly at the start", "position": 0.0, "atSeconds": None})
    if main_point_late:
        first = min(concept_positions.values()) if concept_positions else None
        events.append({"kind": "warn", "label": "Main point arrived late", "position": pos(first) if first is not None else None, "atSeconds": None})

    for e in structure["elements"]:
        if e["found"]:
            events.append({"kind": "good", "label": f"{e['label']} present", "position": e["position"], "atSeconds": None})
        else:
            events.append({"kind": "bad", "label": f"Missing {e['label'].lower()}", "position": None, "atSeconds": None})

    for concept in matched[:3]:
        idx = concept_positions.get(concept)
        events.append({"kind": "good", "label": f"Covered: {concept}", "position": pos(idx) if idx is not None else None, "atSeconds": None})

    for word, idx in filler_positions[:4]:
        events.append({"kind": "warn", "label": f"Filler word \"{word}\"", "position": pos(idx), "atSeconds": None})
    for r in repeats[:3]:
        events.append({"kind": "warn", "label": f"Repeated phrase \"{r['text']}\"", "position": pos(r["position_index"]), "atSeconds": None})
    for phrase, idx in hedge_positions[:3]:
        events.append({"kind": "warn", "label": f"Hedging: \"{phrase}\"", "position": pos(idx), "atSeconds": None})

    lp = communication.get("longPauses")
    if lp:
        for p in lp["items"][:5]:
            events.append(
                {
                    "kind": "warn",
                    "label": f"Long pause ({p['durationSeconds']:.1f}s)",
                    "position": None,
                    "atSeconds": p["startSeconds"],
                }
            )

    def order(ev):
        if ev["position"] is not None:
            return (0, ev["position"])
        if ev["atSeconds"] is not None:
            return (1, ev["atSeconds"])
        return (2, 0)

    events.sort(key=order)
    return events


# --------------------------------------------------------------------------
# "Why this score?" explanations, strengths/weaknesses, practice topics
# --------------------------------------------------------------------------

def _labels(concepts: list, n: int = 5) -> list:
    return [c.split("|")[0].strip() for c in concepts[:n]]


def build_explanations(m: dict) -> dict:
    """`m` is the bag of measurements assembled in local_answer_evaluator.
    Each entry: {"score", "good": [...], "missing": [...], "improve": [...]} where every
    string is derived from a measurement in `m`."""
    wc = m["word_count"]
    matched, missing = m["matched"], m["missing"]
    generic = m["concept_source"] == "question-words"
    ex = {}

    # -- technical accuracy
    good, bad, imp = [], [], []
    if matched:
        verb = "Used key terms from the question" if generic else "Correctly covered"
        good.append(f"{verb}: {', '.join(_labels(matched))}")
    if missing:
        bad.append(
            ("Did not use these key terms from the question: " if generic else "Did not mention: ")
            + ", ".join(_labels(missing))
        )
        imp.append("Review " + ", ".join(_labels(missing, 3)) + " and be ready to explain each in one or two sentences")
    if wc < 15:
        bad.append(f"The answer was very short ({wc} words), which limits how much depth could be credited")
    if m["skill"] and m["topic"] and m["technical"] < 75 and not generic:
        imp.append(f"Practice more {m['skill']} - {m['topic']} questions")
    ex["technical"] = {"score": m["technical"], "good": good, "missing": bad, "improve": imp}
    if generic:
        ex["technical"]["note"] = (
            "This question has no stored answer key, so your answer was compared with the question's own wording."
        )

    # -- communication (composite of fluency, grammar, relevance)
    good, bad, imp = [], [], []
    parts = [("Fluency", m["fluency"]), ("Grammar", m["grammar"]), ("Relevance", m["relevance"])]
    for name, val in parts:
        (good if val >= 75 else bad if val < 60 else []).append(f"{name} {val}%")
    if m["communication_feedback"]:
        (bad if m["communication_flagged"] else good).append(m["communication_feedback"])
    if bad:
        imp.append("Aim for short, complete sentences that stay on the question")
    ex["communication"] = {"score": m["communication"], "good": good, "missing": bad, "improve": imp}

    # -- confidence
    good, bad, imp = [], [], []
    if m["hedges_found"]:
        bad.append("Hedging phrases weakened the answer: " + ", ".join(f'"{h}"' for h in m["hedges_found"][:4]))
        imp.append("State what you know directly; replace \"I think\" with the statement itself")
    else:
        good.append("No hedging phrases such as \"I think\" or \"not sure\"")
    if m["coverage"] >= 0.6:
        good.append("Substantive coverage of the expected points supports a confident delivery")
    elif wc >= 5:
        bad.append("Limited coverage of the expected points made the answer sound less certain")
    if wc < 15:
        bad.append("A very short answer reads as hesitant")
    ex["confidence"] = {"score": m["confidence"], "good": good, "missing": bad, "improve": imp}

    # -- grammar
    good, bad, imp = [], [], []
    for issue in m["grammar_issues"]:
        bad.append(issue)
    if not m["grammar_issues"]:
        good.append("Punctuation and capitalisation were consistent")
    if m["unique_ratio"] >= 0.7 and wc >= 15:
        good.append("Varied vocabulary (little word repetition)")
    elif m["unique_ratio"] < 0.55 and wc >= 15:
        bad.append("Many words were repeated, which lowered vocabulary variety")
    if bad and m["answer_type"] != "voice":
        imp.append("Re-read your answer once for punctuation and sentence endings")
    ex["grammar"] = {"score": m["grammar"], "good": good, "missing": bad, "improve": imp}

    # -- fluency
    good, bad, imp = [], [], []
    if m["filler_count"] == 0:
        good.append("No filler words detected")
    else:
        bad.append(f"{m['filler_count']} filler word(s): " + ", ".join(f"{i['word']} x{i['count']}" for i in m["filler_items"][:4]))
        imp.append("Pause silently instead of saying filler words")
    if 4 <= m["avg_sentence_len"] <= 30:
        good.append(f"Comfortable sentence length (about {round(m['avg_sentence_len'])} words)")
    else:
        bad.append(f"Sentences averaged {round(m['avg_sentence_len'])} words, which is hard to follow")
    lp = m["communication_data"].get("longPauses")
    if lp is not None and lp["count"]:
        bad.append(f"{lp['count']} long pause(s) of {LONG_PAUSE_SECONDS:.0f}s or more were measured in the recording")
    if wc < 15:
        bad.append("Too little text to judge sustained fluency")
    ex["fluency"] = {"score": m["fluency"], "good": good, "missing": bad, "improve": imp}

    # -- relevance
    good, bad, imp = [], [], []
    if m["relevance"] >= 75:
        good.append("The answer engaged closely with the words and concepts of the question")
    elif m["relevance"] < 60:
        bad.append("The answer used few of the terms the question is about")
        imp.append("Restate the question's key term in your first sentence, then answer it")
    if m["unaddressed_terms"]:
        bad.append("Question terms not addressed: " + ", ".join(m["unaddressed_terms"][:5]))
    ex["relevance"] = {"score": m["relevance"], "good": good, "missing": bad, "improve": imp}

    # -- structure
    st = m["structure"]
    good = [f"{e['label']}: \"{e['evidence']}\"" for e in st["elements"] if e["found"]]
    bad = [f"No clear {e['label'].lower()}" for e in st["elements"] if not e["found"]]
    ex["structure"] = {"score": st["score"], "good": good, "missing": bad, "improve": [st["recommendation"]]}

    # -- completeness
    good, bad, imp = [], [], []
    pct = round(m["coverage"] * 100)
    (good if m["coverage"] >= 0.6 else bad).append(
        f"{len(matched)} of {len(matched) + len(missing)} expected points covered ({pct}%)"
    )
    if wc < m["ideal_min"]:
        bad.append(f"Answer length ({wc} words) was below the typical {m['ideal_min']}+ words for this question type")
        imp.append("Add the missing points and one concrete example")
    else:
        good.append("Length was sufficient to develop the answer")
    ex["completeness"] = {"score": m["completeness"], "good": good, "missing": bad, "improve": imp}

    # -- clarity
    good, bad, imp = [], [], []
    if m["hedges_found"]:
        bad.append(f"{len(m['hedges_found'])} hedging phrase(s) blurred the message")
    if m["run_on"]:
        bad.append("Long stretches without punctuation make the answer hard to follow")
        imp.append("Break the answer into shorter sentences")
    if m["repeat_count"]:
        bad.append(f"{m['repeat_count']} repeated word/phrase(s)")
    if m["avg_sentence_len"] > 35:
        bad.append("Very long sentences")
    if not bad:
        good.append("Sentences were clear and easy to follow")
    ex["clarity"] = {"score": m["clarity"], "good": good, "missing": bad, "improve": imp}

    # -- conciseness
    good, bad, imp = [], [], []
    if m["communication_data"]["length"] == "long":
        bad.append(f"{wc} words is longer than the ~{m['ideal_max']} words this question usually needs")
        imp.append("Lead with the answer, then trim tangents")
    elif m["communication_data"]["length"] in ("short", "extremely_short"):
        bad.append(f"Only {wc} words - brevity here came from missing content, not from being concise")
    else:
        good.append("Length was in a sensible range")
    if m["filler_count"] >= 3:
        bad.append("Filler words padded the answer")
    if m["repeat_count"]:
        bad.append("Repeated phrases added length without new information")
    if m["main_point_late"]:
        bad.append("The main point arrived late in the answer")
        imp.append("Put the key point in the first sentence")
    ex["conciseness"] = {"score": m["conciseness"], "good": good, "missing": bad, "improve": imp}

    return ex


def _dedupe(items: list, limit: int) -> list:
    seen, out = set(), []
    for i in items:
        if i and i not in seen:
            seen.add(i)
            out.append(i)
    return out[:limit]


def summarize(m: dict, explanations: dict) -> dict:
    strengths, weaknesses, actions = [], [], []
    if m["matched"] and not m["concept_source"] == "question-words":
        strengths.append("Covered: " + ", ".join(_labels(m["matched"], 4)))
    for e in m["structure"]["elements"]:
        if e["found"]:
            strengths.append(f"{e['label']} was present")
    if not m["hedges_found"] and m["word_count"] >= 15:
        strengths.append("Assertive tone with no hedging")
    if m["filler_count"] == 0 and m["word_count"] >= 15:
        strengths.append("No filler words")
    if m["communication_data"]["length"] == "appropriate":
        strengths.append("Answer length was appropriate")
    sr = m["communication_data"].get("speakingRate")
    if sr and sr["label"] == "Normal":
        strengths.append(f"Normal speaking rate (~{sr['wpm']} words/min)")

    if m["missing"]:
        label = "Key terms from the question not used: " if m["concept_source"] == "question-words" else "Missing: "
        weaknesses.append(label + ", ".join(_labels(m["missing"], 4)))
    for e in m["structure"]["elements"]:
        if not e["found"]:
            weaknesses.append(f"No clear {e['label'].lower()}")
    if m["hedges_found"]:
        weaknesses.append("Hedging language (" + ", ".join(f'"{h}"' for h in m["hedges_found"][:2]) + ")")
    if m["filler_count"] >= 3:
        weaknesses.append(f"{m['filler_count']} filler words")
    if m["communication_data"]["length"] in ("short", "extremely_short"):
        weaknesses.append("Answer was too short")
    elif m["communication_data"]["length"] == "long":
        weaknesses.append("Answer was longer than needed")
    if m["main_point_late"]:
        weaknesses.append("Main point came late")

    for key in ("technical", "structure", "completeness", "conciseness", "clarity", "fluency", "confidence"):
        actions.extend(explanations[key]["improve"])

    topics = []
    if m["skill"] and m["skill"] not in ("HR", "Behavioral", "Resume", "Project") and m["technical"] < 70 and m["concept_source"] != "question-words":
        topics.append(f"{m['skill']}: {m['topic']}" if m["topic"] else m["skill"])
    if m["question_type"] == "project" and (m["structure"]["score"] < 70 or m["technical"] < 70):
        topics.append("Project explanation")
    if m["question_type"] in ("behavioral", "hr") and m["structure"]["score"] < 70:
        topics.append("Structured behavioral answers (STAR)")
    if m["concept_source"] != "question-words":
        topics.extend(_labels(m["missing"], 3))

    return {
        "strengths": _dedupe(strengths, 5),
        "weaknesses": _dedupe(weaknesses, 5),
        "improvements": _dedupe(actions, 6),
        "practiceTopics": _dedupe(topics, 5),
    }
