# Tech Question Dataset — Schema

One JSON array per technology file: `python.json`, `java.json`, `sql.json`, `cpp.json`, `c.json`, `html.json`, `css.json`, `javascript.json`, `react.json`, `nodejs.json`.

## Universal fields (every record)

```json
{
  "id": "python_001",
  "technology": "Python",
  "topic": "OOP",
  "difficulty": "Easy" | "Medium" | "Hard",
  "question": "...",
  "answer": "...",
  "explanation": "...",
  "question_type": "MCQ" | "Technical" | "Conceptual" | "Coding" | "Output Prediction" | "Debugging" | "Scenario Based" | "SQL Query" | "Programming Problem",
  "keywords": ["class", "object", "inheritance"]
}
```

- `id`: `{technology_lower_no_symbols}_{3-digit sequence}`, e.g. `python_001`, `cpp_037`, `nodejs_104`. Sequence is unique per technology file, zero-padded to at least 3 digits (4 if a file exceeds 999).
- `technology`: EXACTLY one of `Python, Java, SQL, C++, C, HTML, CSS, JavaScript, React, Node.js` (case-sensitive, matches the filename's technology).
- `answer`: for non-MCQ types this is the correct/model answer in prose (Conceptual/Technical/Scenario Based), the expected output string (Output Prediction), the corrected code or bug description (Debugging), or the correct query (SQL Query). For MCQ, `answer` should restate the correct option's text (redundant with `options[correct_option]` but keeps the record self-describing).
- `explanation`: WHY the answer is correct — the reasoning, not a restatement of the answer.
- `keywords`: 3-6 lowercase terms used for retrieval/adaptive matching, not necessarily verbatim from the question.

## MCQ-only additional fields

```json
"options": ["...", "...", "...", "..."],
"correct_option": 0
```

- Exactly 4 options.
- `correct_option` is a **0-based index** into `options` (0, 1, 2, or 3) — matches the indexing convention already used by `AptitudeQuestion.correctAnswer` elsewhere in this codebase.

## Coding / Programming Problem additional fields

```json
"starter_code": "...",
"expected_solution": "...",
"test_cases": [
  { "input": "...", "expected_output": "..." }
]
```

- `starter_code`: a short function/method signature or stub the candidate would start from (language matches the technology; for HTML/CSS use a minimal starting snippet instead of a function stub).
- `expected_solution`: one correct, runnable-looking reference solution.
- `test_cases`: at least 2 input/output pairs. `input` and `expected_output` are strings (describe stdin/args and expected stdout/return value in words if a literal value doesn't apply, e.g. for HTML/CSS layout tasks).

## Output Prediction additional field

```json
"code_snippet": "..."
```

`answer` holds the exact predicted output.

## Debugging additional fields

```json
"buggy_code": "...",
"fixed_code": "..."
```

`answer` should name the bug concisely; `explanation` covers why it breaks and why the fix works.

## SQL Query (SQL technology only) additional field

```json
"schema_context": "-- table definitions the query is written against"
```

`answer` holds the correct SQL query.

## Hard rules

1. **No duplicate questions** — not exact-text duplicates, and not trivial rewordings of the same concept+topic+difficulty already present in the same file.
2. **Every answer must be technically correct** — verify mentally against real language/framework semantics before writing it down. Do not guess.
3. **Difficulty must match content**: Easy = definitional/single-concept, Medium = combines 2+ concepts or requires reasoning about behavior, Hard = edge cases, performance/internals, multi-step reasoning, or non-obvious gotchas.
4. **Topic coverage must span the full topic list given for that technology** — not clustered on 2-3 easy topics.
5. Valid JSON, UTF-8, no trailing commas, no comments in the actual data files (comments are fine here in SCHEMA.md only).
