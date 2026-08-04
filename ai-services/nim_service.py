import os
import json
import random
import requests
from typing import Optional

NIM_API_URL = os.getenv("NIM_API_URL", "https://api.nvcf.nvidia.com/v2/nvcf")
NIM_API_KEY = os.getenv("NIM_API_KEY", "")
NIM_MODEL = os.getenv("NIM_MODEL", "meta/llama-3.1-405b-instruct")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

HEADERS = {
    "Authorization": f"Bearer {NIM_API_KEY}",
    "Content-Type": "application/json",
}


def _call_groq(prompt: str, system_prompt: str = "") -> Optional[str]:
    if not GROQ_API_KEY:
        return None

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "temperature": 0.9,
        "max_tokens": 1024,
        "top_p": 0.95,
    }

    try:
        resp = requests.post(
            GROQ_API_URL,
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"Groq API error: {e}")
        return None


def _call_nim(prompt: str, system_prompt: str = "") -> Optional[str]:
    if not NIM_API_KEY:
        return _call_groq(prompt, system_prompt)

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": NIM_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1024,
        "top_p": 0.95,
    }

    try:
        resp = requests.post(
            f"{NIM_API_URL}/chat/completions",
            headers=HEADERS,
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"NIM API error: {e}")
        return _call_groq(prompt, system_prompt)


def _dedupe(questions):
    seen = set()
    result = []
    for q in questions:
        key = q.strip().lower()
        if key not in seen:
            seen.add(key)
            result.append(q.strip())
    return result


def generate_questions(
    job_role: str,
    experience_level: str,
    interview_type: str,
    difficulty: str,
    total_questions: int,
) -> list:
    system_prompt = (
        "You are an expert technical interviewer at a top tech company. "
        "Generate high-quality interview questions that assess real-world skills."
    )

    prompt = (
        f"Generate {total_questions} UNIQUE {difficulty} difficulty {interview_type} interview questions "
        f"for a {experience_level} level {job_role} position. "
        "Every question MUST be different and specifically about this exact role "
        "(its frameworks, tools, concepts, and real scenarios). Do not use generic "
        "questions that would fit any role. "
        "Return ONLY a JSON array of strings, no other text. "
        "Format: [\"Question 1\", \"Question 2\", ...]"
    )

    result = _call_nim(prompt, system_prompt)
    if result:
        try:
            cleaned = result.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            questions = json.loads(cleaned.strip())
            return _dedupe(questions)[:total_questions]
        except (json.JSONDecodeError, KeyError):
            questions = [
                line.strip().lstrip("1234567890. )-").strip()
                for line in result.split("\n")
                if line.strip() and not line.startswith("```")
            ]
            if questions:
                return _dedupe(questions)[:total_questions]

    fallback = {
        "Technical": [
            f"Explain the core concepts and technologies used in {job_role}.",
            f"How would you design a scalable system for {job_role}?",
            f"What are the best practices for optimizing performance in {job_role}?",
            f"Describe your approach to debugging complex issues in {job_role}.",
            f"What security considerations are important for {job_role}?",
            f"Which tools and frameworks are essential for a {job_role} professional?",
            f"How would you architect a new feature from scratch for {job_role}?",
            f"What common pitfalls should a {job_role} developer avoid?",
            f"How do you measure the success of your work as a {job_role}?",
            f"Describe a challenging production issue you might face in {job_role} and how to solve it.",
        ],
        "HR": [
            f"Tell me about yourself and why you're interested in {job_role}.",
            "What are your greatest professional strengths?",
            "Describe a situation where you handled a difficult workplace conflict.",
            "Where do you see yourself in 5 years?",
            "Why should we hire you for this position?",
            f"What excites you most about a {job_role} role?",
            "Describe a time you failed and what you learned.",
            "How do you handle constructive criticism?",
            "What motivates you professionally?",
            "Describe your leadership style.",
        ],
        "Behavioral": [
            f"Describe a time you worked successfully in a team for {job_role}.",
            "Tell me about a project that failed and what you learned.",
            "How do you prioritize tasks under multiple deadlines?",
            "Describe a situation where you had to learn a new technology quickly.",
            "Tell me about a time you disagreed with a teammate's approach.",
            "Describe a time you mentored or helped a teammate.",
            "How do you handle pressure in a fast-paced environment?",
            "Tell me about a time you had to make a decision with incomplete information.",
            "Describe a time you took initiative beyond your responsibilities.",
            "How do you ensure clear communication within your team?",
        ],
    }

    pool = fallback.get(interview_type, fallback["Technical"])
    return _dedupe(random.sample(pool, min(len(pool), total_questions)))[:total_questions]


def evaluate_answer(
    question: str,
    answer: str,
    interview_type: str,
    difficulty: str,
    job_role: str,
) -> dict:
    system_prompt = (
        "You are an AI interview evaluator. Evaluate the candidate's answer and "
        "return a JSON object with scores from 0-100 for each category and feedback. "
        "Be honest and constructive."
    )

    prompt = (
        f"Interview Type: {interview_type}\n"
        f"Difficulty: {difficulty}\n"
        f"Job Role: {job_role}\n"
        f"Question: {question}\n"
        f"Candidate Answer: {answer}\n\n"
        "Evaluate the answer and return ONLY a JSON object with these fields:\n"
        "{\n"
        '  "technicalScore": 0-100,\n'
        '  "communicationScore": 0-100,\n'
        '  "confidenceScore": 0-100,\n'
        '  "grammarScore": 0-100,\n'
        '  "fluencyScore": 0-100,\n'
        '  "relevanceScore": 0-100,\n'
        '  "feedback": "constructive feedback string"\n'
        "}\n\n"
        "Do not include any text outside the JSON object."
    )

    result = _call_nim(prompt, system_prompt)
    if result:
        try:
            cleaned = result.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            return json.loads(cleaned.strip())
        except (json.JSONDecodeError, KeyError):
            pass

    return {
        "technicalScore": 75,
        "communicationScore": 75,
        "confidenceScore": 75,
        "grammarScore": 75,
        "fluencyScore": 75,
        "relevanceScore": 75,
        "feedback": "Good attempt. Consider providing more specific examples and technical details in your answer.",
    }


def generate_feedback(scores: dict, strengths: list, weaknesses: list, job_role: str) -> str:
    system_prompt = "You are a career coach providing interview feedback."

    prompt = (
        f"Job Role: {job_role}\n"
        f"Scores: {json.dumps(scores)}\n"
        f"Strengths: {json.dumps(strengths)}\n"
        f"Weaknesses: {json.dumps(weaknesses)}\n\n"
        "Provide a detailed, encouraging final feedback paragraph (2-3 sentences) "
        "with actionable advice for improvement."
    )

    result = _call_nim(prompt, system_prompt)
    if result:
        return result.strip()

    overall = scores.get("overall", 70)
    if overall >= 80:
        return (
            f"Excellent performance! Your strong {', '.join(strengths[:2]).lower()} "
            f"demonstrate solid preparation for {job_role} roles. "
            f"Continue building on these strengths while addressing areas like "
            f"{', '.join(weaknesses[:2]).lower()} to reach an even higher level."
        )
    elif overall >= 60:
        return (
            f"Good effort! You showed competence in {', '.join(strengths[:2]).lower()}. "
            f"To improve further, focus on {', '.join(weaknesses[:2]).lower()}. "
            f"Regular practice with mock interviews will help build confidence for {job_role} positions."
        )
    else:
        return (
            f"This is a good starting point. Focus on building your knowledge in {job_role} "
            f"and practice articulating your thoughts clearly. "
            f"Consider studying common interview questions and practicing with peers to improve."
        )
