"""
Phase 6 - Application integration.

generate_interview_questions() is the single entry point the Flask AI service
(server.py) calls for the mock-interview question set. It replaces the old
Groq / NVIDIA NIM / Ollama LLM-API chain for TECHNICAL questions with the
locally fine-tuned model (LocalQuestionGenerator), which in turn falls back to
the offline question bank on any failure (Phase 7). HR and Behavioral
questions were never skill/topic based, so they continue to be served from
the curated static pools below - no LLM and no API key involved either way.

Candidate skills (from a parsed resume, if available) are used to bias which
technical skill/topic combinations are asked about.
"""

import json
import os
import random
import re

from local_question_generator import get_generator, normalize_for_compare, config
from question_history_store import get_store

_RAW_DATASET_CACHE = None
_HR_BEHAVIORAL_CACHE = None

HR_BEHAVIORAL_DATASET_PATH = os.path.join(
    os.path.dirname(os.path.abspath(config.QUESTION_BANK_PATH)), "hr_behavioral_dataset.json"
)


def _load_raw_dataset():
    global _RAW_DATASET_CACHE
    if _RAW_DATASET_CACHE is None:
        with open(config.QUESTION_BANK_PATH, "r", encoding="utf-8") as f:
            _RAW_DATASET_CACHE = json.load(f)
    return _RAW_DATASET_CACHE


def _load_hr_behavioral_dataset():
    """Local, curated, difficulty-tiered dataset of HR/Behavioral questions
    (training/data/interview_questions/hr_behavioral_dataset.json). Replaces
    the old bare in-code list so HR/Behavioral selection is driven by the same
    kind of structured local training data as technical questions, and so
    `local_answer_evaluator` has concept tags to grade against."""
    global _HR_BEHAVIORAL_CACHE
    if _HR_BEHAVIORAL_CACHE is None:
        with open(HR_BEHAVIORAL_DATASET_PATH, "r", encoding="utf-8") as f:
            _HR_BEHAVIORAL_CACHE = json.load(f)
    return _HR_BEHAVIORAL_CACHE


def _topics_for_skill(skill: str) -> list:
    records = _load_raw_dataset()
    topics = sorted({r["topic"] for r in records if r["skill"].lower() == skill.lower()})
    return topics or ["General Concepts"]


# Role -> ordered list of skills to draw technical questions from. Matched by
# substring against the candidate's job role (case-insensitive). Order acts as
# a rough weighting (earlier skills are sampled more often).
ROLE_SKILL_MAP = [
    (["frontend", "front-end", "front end", "ui developer", "react developer"],
     ["JavaScript", "Web Development", "Data Structures"]),
    (["full stack", "fullstack", "full-stack"],
     ["JavaScript", "Web Development", "SQL", "DBMS", "Python", "Data Structures"]),
    (["backend", "back-end", "back end", "server"],
     ["Python", "Java", "SQL", "DBMS", "Data Structures", "Algorithms", "Operating Systems"]),
    (["data scientist", "data science", "data analyst"],
     ["Machine Learning", "Artificial Intelligence", "SQL", "Python"]),
    (["machine learning", "ml engineer", "ai engineer", "artificial intelligence"],
     ["Machine Learning", "Artificial Intelligence", "Python", "Data Structures"]),
    (["devops", "cloud", "site reliability", "sre", "infrastructure"],
     ["Operating Systems", "Computer Networks", "SQL", "Web Development"]),
    (["mobile", "android", "ios developer"],
     ["Java", "OOP", "Data Structures", "Algorithms"]),
    (["java developer", "java engineer"], ["Java", "OOP", "DBMS", "SQL", "Data Structures"]),
    (["python developer", "python engineer"], ["Python", "OOP", "Data Structures", "Algorithms"]),
    (["database", "dba", "data engineer"], ["SQL", "DBMS", "Data Structures"]),
    (["network", "security engineer"], ["Computer Networks", "Operating Systems"]),
]

DEFAULT_SKILLS = [
    "Data Structures", "Algorithms", "OOP", "DBMS", "SQL",
    "Operating Systems", "Computer Networks", "Python", "Java", "Web Development",
]

# Resume/skill keyword -> canonical dataset skill name.
RESUME_SKILL_ALIASES = {
    "python": "Python", "java": "Java", "c++": "C++", "cpp": "C++", "c": "C",
    "javascript": "JavaScript", "js": "JavaScript", "typescript": "JavaScript",
    "sql": "SQL", "mysql": "SQL", "postgresql": "SQL", "postgres": "SQL",
    "dbms": "DBMS", "database": "DBMS",
    "oop": "OOP", "object oriented programming": "OOP",
    "data structures": "Data Structures", "dsa": "Data Structures",
    "algorithms": "Algorithms",
    "networking": "Computer Networks", "computer networks": "Computer Networks",
    "operating systems": "Operating Systems", "os": "Operating Systems",
    "machine learning": "Machine Learning", "ml": "Machine Learning",
    "artificial intelligence": "Artificial Intelligence", "ai": "Artificial Intelligence",
    "react": "Web Development", "node": "Web Development", "html": "Web Development",
    "css": "Web Development", "web development": "Web Development",
    # Frameworks/tools that show up on resumes and map onto an existing
    # dataset skill, so a resume listing them biases the skill questions.
    "node.js": "Web Development", "nodejs": "Web Development", "express": "Web Development",
    "express.js": "Web Development", "react.js": "Web Development", "reactjs": "Web Development",
    "next.js": "Web Development", "angular": "Web Development", "vue": "Web Development",
    "vue.js": "Web Development", "tailwind": "Web Development", "tailwind css": "Web Development",
    "bootstrap": "Web Development",
    "mongodb": "DBMS", "nosql": "DBMS", "sqlite": "SQL", "nosql databases": "DBMS",
    "django": "Python", "flask": "Python", "fastapi": "Python", "pandas": "Python", "numpy": "Python",
    "spring": "Java", "spring boot": "Java", "hibernate": "Java",
    "tensorflow": "Machine Learning", "pytorch": "Machine Learning", "scikit-learn": "Machine Learning",
    "deep learning": "Machine Learning",
    "linux": "Operating Systems", "docker": "Operating Systems",
}

EXPERIENCE_TO_LEVEL = {
    "fresher": "Fresher", "junior": "Fresher",
    "mid": "Intermediate", "intermediate": "Intermediate",
    "senior": "Experienced", "lead": "Experienced",
}



def _resolve_skills(job_role: str, resume_skills: list) -> list:
    job_role_lower = (job_role or "").lower()
    mapped = None
    for keywords, skills in ROLE_SKILL_MAP:
        if any(kw in job_role_lower for kw in keywords):
            mapped = skills
            break
    skills = list(mapped or DEFAULT_SKILLS)

    resume_matched = []
    for raw_skill in resume_skills or []:
        canonical = RESUME_SKILL_ALIASES.get(str(raw_skill).strip().lower())
        if canonical and canonical not in resume_matched:
            resume_matched.append(canonical)

    # Resume skills take priority, but keep role-relevant skills as backup so
    # we don't run out of topics if the resume only mentions one or two things.
    ordered = resume_matched + [s for s in skills if s not in resume_matched]
    return ordered or DEFAULT_SKILLS


def _candidate_level(experience_level: str) -> str:
    return EXPERIENCE_TO_LEVEL.get((experience_level or "").strip().lower(), "Fresher")


def generate_technical_questions(
    job_role: str,
    experience_level: str,
    difficulty: str,
    total_questions: int,
    resume_skills: list = None,
    previous_questions: str = "",
    user_id: str = "",
    session_id: str = "",
    focus_areas: list = None,
) -> list:
    """Returns a list of {"question", "skill", "topic"} dicts. Every accepted
    question passes BOTH the per-request exclude list AND the GLOBAL,
    persistent cross-user history store (Rule 5/6) before being accepted, and
    is marked used in that store immediately so a concurrent request for a
    different user can never receive the same question."""
    generator = get_generator()
    store = get_store()
    skills = _resolve_skills(job_role, resume_skills or [])
    level = _candidate_level(experience_level)

    exclude = [q for q in (previous_questions or "").split("\n") if q.strip()]
    exclude_norms = {normalize_for_compare(q) for q in exclude}
    questions = []

    # Personalisation: the candidate's own previous interviews showed weakness in these
    # skill/topic areas, so a share of this interview's questions is drawn from them
    # (never all of them - the rest still follows the role/resume mix). Only skills that
    # exist in the local dataset are honoured, so nothing is invented.
    known_skills = {r["skill"] for r in _load_raw_dataset()}
    focus = [
        f for f in (focus_areas or [])
        if isinstance(f, dict) and f.get("skill") in known_skills
    ][:4]
    focus_target = min(total_questions, max(1, round(total_questions * 0.4))) if focus else 0
    focus_used = 0
    focus_failures = 0

    attempts = 0
    max_attempts = total_questions * 8  # generous ceiling so we never loop forever
    skill_idx = 0
    while len(questions) < total_questions and attempts < max_attempts:
        attempts += 1
        is_focus = bool(focus) and focus_used < focus_target and focus_failures < 6
        if is_focus:
            area = focus[focus_used % len(focus)]
            skill = area["skill"]
            topics = _topics_for_skill(skill)
            topic = area.get("topic") if area.get("topic") in topics else random.choice(topics)
        else:
            skill = skills[skill_idx % len(skills)]
            skill_idx += 1
            topics = _topics_for_skill(skill)
            topic = random.choice(topics)

        result = generator.generate_question(
            skill=skill,
            topic=topic,
            difficulty=difficulty or "Medium",
            candidate_level=level,
            resume_skills=resume_skills,
            exclude_questions=exclude + [q["question"] for q in questions],
            job_role=job_role,
            # global cross-user history is checked INSIDE the model's retry loop, so a repeat is re-sampled at once
            reject_if=lambda q, _s=skill, _t=topic: store.is_duplicate(q, skill=_s, topic=_t),
        )
        question = result["question"]
        norm = normalize_for_compare(question)
        if norm in exclude_norms or norm in {normalize_for_compare(q["question"]) for q in questions}:
            focus_failures += 1 if is_focus else 0
            continue
        if store.is_duplicate(question, skill=skill, topic=topic):
            focus_failures += 1 if is_focus else 0
            continue  # already shown to some user, ever - reject and try another

        store.mark_used(
            question, skill=skill, topic=topic, interview_type="Technical",
            difficulty=difficulty, experience_level=experience_level, job_role=job_role,
            user_id=user_id, session_id=session_id, source=result.get("source", ""),
        )
        item = {"question": question, "skill": skill, "topic": topic}
        if is_focus:
            focus_used += 1
            item["focusArea"] = f"{skill}: {topic}" if topic else skill
        questions.append(item)

    return questions


def generate_hr_or_behavioral_questions(
    interview_type: str,
    difficulty: str,
    total_questions: int,
    previous_questions: str = "",
    user_id: str = "",
    session_id: str = "",
) -> list:
    """Selects from the local, difficulty-tiered HR/Behavioral dataset
    (training/data/interview_questions/hr_behavioral_dataset.json). Applies
    the same global cross-user duplicate rejection as technical questions."""
    store = get_store()
    dataset = [r for r in _load_hr_behavioral_dataset() if r["interview_type"] == interview_type]
    exclude_norms = {normalize_for_compare(q) for q in (previous_questions or "").split("\n") if q.strip()}

    def _pool(records):
        candidates = [
            r for r in records
            if normalize_for_compare(r["question"]) not in exclude_norms
            and not store.is_duplicate(r["question"], skill=interview_type, topic="")
        ]
        random.shuffle(candidates)
        return candidates

    # Prefer questions matching the requested difficulty; widen to the whole
    # type-pool (any difficulty) only if that tier alone can't cover the count.
    same_difficulty = [r for r in dataset if r["difficulty"] == difficulty]
    pool = _pool(same_difficulty)
    if len(pool) < total_questions:
        other_difficulty = [r for r in dataset if r["difficulty"] != difficulty]
        pool = pool + _pool(other_difficulty)

    selected = pool[:total_questions]
    for r in selected:
        store.mark_used(
            r["question"], skill=interview_type, topic="", interview_type=interview_type,
            difficulty=r["difficulty"], user_id=user_id, session_id=session_id, source="dataset",
        )
    return [{"question": r["question"], "skill": interview_type, "topic": ""} for r in selected]


# Resume-based interview: questions about the candidate's OWN projects.
#
# Each template carries the concepts a good answer should touch. A concept
# written "a|b|c" is covered if the answer uses any of those wordings (see
# local_answer_evaluator._concept_matched). Project-specific concepts (the
# project's technologies and description keywords) are appended per project so
# an answer that names the real stack scores as more grounded than a generic one.
# `needs_tech` templates are skipped for projects with no listed technologies.
_PROJECT_TEMPLATES = [
    {
        "key": "overview",
        "needs_tech": False,
        "question": 'Tell me about your project "{name}". What problem does it solve, and what was your role in building it?',
        "concepts": ["problem|goal|purpose", "user|customer|client", "role|responsib|built|developed|implemented", "feature"],
    },
    {
        "key": "tech_choice",
        "needs_tech": True,
        "question": 'In "{name}", why did you choose {tech}? What alternatives did you consider, and what trade-offs did you accept?',
        "concepts": ["alternative|instead|compared|option", "trade off|tradeoff|advantage|disadvantage|because", "performance|scalab|simplicity|ecosystem|community"],
    },
    {
        "key": "challenge",
        "needs_tech": False,
        "question": 'What was the hardest technical challenge you faced in "{name}", and how did you solve it?',
        "concepts": ["challenge|problem|issue|bug", "solve|fix|resolve|solution", "debug|test|investigat|research|approach", "learn"],
    },
    {
        "key": "flow",
        "needs_tech": True,
        "question": 'Walk me through how data or a request flows through "{name}" from start to finish, and where {tech} fits in.',
        "concepts": ["request|input|user", "data|database|storage", "api|endpoint|server|backend|frontend", "respons|output|result"],
    },
    {
        "key": "scale",
        "needs_tech": False,
        "question": 'If "{name}" suddenly had ten times more users, what would break first and what would you change?',
        "concepts": ["scal", "database|query|index", "cache|caching", "load|traffic|balanc", "bottleneck|performance|optimi"],
    },
    {
        "key": "testing",
        "needs_tech": False,
        "question": 'How did you test and validate "{name}", and how does it handle errors and edge cases?',
        "concepts": ["test", "error|exception|fail", "edge case|validation|validate", "log|monitor"],
    },
]

_MAX_PROJECTS_USED = 3
_DESCRIPTION_STOPWORDS = {
    "using", "used", "built", "developed", "created", "implemented", "designed", "application",
    "project", "system", "with", "that", "this", "their", "which", "based", "features", "feature",
}


def _project_specific_concepts(project: dict) -> list:
    """The project's own technologies + salient description words, capped so
    they can't drown out the template's concepts."""
    techs = []
    for t in project.get("technologies") or []:
        t = str(t).strip()
        # Very short names (C, R, Go) are dropped: as a substring they would
        # "match" almost any answer and inflate the score.
        if len(normalize_for_compare(t)) >= 3 and t.lower() not in [x.lower() for x in techs]:
            techs.append(t)

    words = []
    for w in re.findall(r"[A-Za-z][A-Za-z0-9+#.\-]{4,}", str(project.get("description") or "")):
        lw = w.lower().strip(".-")
        if lw not in _DESCRIPTION_STOPWORDS and lw not in words and lw not in [t.lower() for t in techs]:
            words.append(lw)

    return [t.lower() for t in techs[:2]] + words[:2]


def _project_question_candidates(projects: list, exclude_norms: set) -> list:
    """Round-robins templates across the first few projects (so one project
    doesn't take every slot), skipping any question this user already saw."""
    usable = [p for p in (projects or []) if str(p.get("name") or "").strip()][:_MAX_PROJECTS_USED]
    candidates = []
    for template in _PROJECT_TEMPLATES:
        for project in usable:
            techs = [str(t).strip() for t in (project.get("technologies") or []) if str(t).strip()]
            if template["needs_tech"] and not techs:
                continue
            name = str(project["name"]).strip()
            question = template["question"].format(name=name, tech=techs[0] if techs else "")
            if normalize_for_compare(question) in exclude_norms:
                continue
            candidates.append({
                "question": question,
                "skill": "Project",
                "topic": name,
                "concepts": template["concepts"] + _project_specific_concepts(project),
            })
    return candidates


def generate_resume_questions(
    job_role: str,
    experience_level: str,
    difficulty: str,
    total_questions: int,
    resume: dict,
    previous_questions: str = "",
    user_id: str = "",
    session_id: str = "",
    focus_areas: list = None,
) -> list:
    """Resume-based interview: about half the questions probe the candidate's
    own projects (why this stack, hardest problem, scaling, testing...), the
    rest verify the skills the resume claims using the local technical
    dataset. Project questions are personal to one resume, so they are NOT
    put through the global cross-user duplicate store (two candidates can
    legitimately share a project name); repeats are avoided per user via
    `previous_questions` instead, which makes a re-take rotate templates."""
    resume = resume or {}
    exclude_norms = {normalize_for_compare(q) for q in (previous_questions or "").split("\n") if q.strip()}

    candidates = _project_question_candidates(resume.get("projects") or [], exclude_norms)
    project_target = min(len(candidates), max(1, (total_questions + 1) // 2)) if candidates else 0
    # Personalisation: earlier interviews showed weak project explanations -> more project-depth questions.
    if candidates and any(isinstance(f, dict) and f.get("skill") == "Project" for f in (focus_areas or [])):
        project_target = min(len(candidates), max(project_target, round(total_questions * 0.7)))
    project_questions = candidates[:project_target]

    skill_questions = []
    remaining = total_questions - len(project_questions)
    if remaining > 0:
        skill_questions = generate_technical_questions(
            job_role, experience_level, difficulty, remaining, resume.get("skills") or [],
            previous_questions, user_id, session_id, focus_areas,
        )

    return project_questions + skill_questions


def generate_questions(
    job_role: str,
    experience_level: str,
    interview_type: str,
    difficulty: str,
    total_questions: int,
    context: str = "",
    previous_questions: str = "",
    resume_skills: list = None,
    user_id: str = "",
    session_id: str = "",
    resume: dict = None,
    focus_areas: list = None,
) -> dict:
    """Zero external API calls for question generation. Returns
    {"questions": [{"question","skill","topic"}, ...], "requested": int,
    "insufficient": bool} - "insufficient" is true when the local dataset/model
    could not produce enough GLOBALLY-unused questions to hit the requested
    count (Rule 7: never silently repeat a question to make up the number)."""
    if interview_type == "HR" or interview_type == "Behavioral":
        questions = generate_hr_or_behavioral_questions(
            interview_type, difficulty, total_questions, previous_questions, user_id, session_id
        )
    elif interview_type == "Resume":
        questions = generate_resume_questions(
            job_role, experience_level, difficulty, total_questions, resume or {},
            previous_questions, user_id, session_id, focus_areas,
        )
    else:
        questions = generate_technical_questions(
            job_role, experience_level, difficulty, total_questions, resume_skills,
            previous_questions, user_id, session_id, focus_areas,
        )
    return {
        "questions": questions,
        "requested": total_questions,
        "insufficient": len(questions) < total_questions,
    }
