import os
import json
import base64
import io
import tempfile
import threading
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import cv2

load_dotenv()

# Answer evaluation and final feedback now run entirely on local, transparent
# text-analysis logic (local_answer_evaluator) - no Groq/OpenAI/Gemini/NIM/
# Ollama API call is made anywhere in the interview-intelligence pipeline.
from local_answer_evaluator import evaluate_answer, generate_feedback
# Question generation runs entirely on the locally fine-tuned model (with an
# offline question-bank fallback) - no Groq/OpenAI/Gemini/NIM API key required.
from interview_question_service import generate_questions
from local_question_generator import get_generator
# Resume summary/bullet rewriting runs on a second locally fine-tuned model
# (falls back to a local rule-based rewrite) - no external API required.
from resume_enhancer import get_enhancer, enhance_resume_content
# Resume-category classification: local TF-IDF + calibrated Linear SVM,
# trained on snehaanbhawal/resume-dataset - see
# resume_training/data/reports/dataset_usage_report.md and
# resume_classifier_eval.json for how it was chosen and its real accuracy
# (test macro-F1 ~0.60 across 24 classes - an additional signal, not a
# replacement for the existing deterministic resume parser/analyzer). No
# external API; returns None on any load failure so callers fall back cleanly.
from resume_training.inference import classify_resume as classify_resume_category
from riva_service import text_to_speech, speech_to_text
from face_detection import analyze_frame, release_resources
# Trained tech-question practice system (Python/Java/SQL/C++/C/HTML/CSS/
# JavaScript/React/Node.js) - a local, verified Q&A dataset + deterministic
# selection engine + local per-question-type answer evaluator. No LLM API
# involved in selecting questions, generating answers, or grading them.
from tech_question_engine import get_engine as get_tech_question_engine
from tech_answer_evaluator import evaluate_tech_answer

app = Flask(__name__)
CORS(app)

AI_SERVICE_KEY = os.getenv("AI_SERVICE_KEY", "mindprep-ai-key-2026")

# Load the fine-tuned question-generation model once, in the background, at
# process startup (Phase 11) - so the first real interview request doesn't
# pay the model-load cost. This never blocks server startup and never raises:
# LocalQuestionGenerator swallows load failures internally and falls back to
# the offline question bank per-request instead.
threading.Thread(target=lambda: get_generator()._ensure_loaded(), daemon=True).start()
threading.Thread(target=lambda: get_enhancer()._ensure_loaded(), daemon=True).start()
# Fine-tuned software-engineering interviewer (interviewer_llm/): warmed in its own thread; until it is loaded (or if it
# is not trained / fails to load) questions come from the previous chain, so this can never block or break a request.
get_generator().warm_interviewer()

# Tech-question index is a plain JSON load (no model weights) - cheap enough
# to load synchronously at startup so a missing/invalid index is surfaced in
# the startup log immediately rather than on the first request.
_tech_engine = get_tech_question_engine()
if not _tech_engine.is_loaded:
    print(f"[tech-questions] WARNING: {_tech_engine.load_error}")


def require_auth(f):
    def wrapper(*args, **kwargs):
        auth = request.headers.get("X-AI-Service-Key", "")
        if auth != AI_SERVICE_KEY:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "service": "ai-services"})


@app.route("/model-status", methods=["GET"])
def model_status():
    generator = get_generator()
    return jsonify(
        {
            "model_loaded": generator.is_loaded,
            "load_error": generator._load_error,
            "last_load_time_ms": generator.last_load_time_ms,
            "interviewer_llm": generator.interviewer_status(),
            "requires_api_key": False,
        }
    )


@app.route("/generate-questions", methods=["POST"])
@require_auth
def api_generate_questions():
    data = request.json
    result = generate_questions(
        job_role=data.get("jobRole", ""),
        experience_level=data.get("experienceLevel", ""),
        interview_type=data.get("interviewType", "Technical"),
        difficulty=data.get("difficulty", "Medium"),
        total_questions=data.get("totalQuestions", 5),
        context=data.get("context", ""),
        previous_questions=data.get("previousQuestions", ""),
        resume_skills=data.get("resumeSkills", []),
        user_id=data.get("userId", ""),
        session_id=data.get("interviewId", ""),
        resume=data.get("resume") or {},
        focus_areas=data.get("focusAreas") or [],
    )
    return jsonify(result)


@app.route("/generate-quiz-question", methods=["POST"])
@require_auth
def api_generate_quiz_question():
    """Backs the Node backend's legacy POST /questions/generate (topic +
    difficulty -> a single standalone quiz question) - previously a live
    Gemini call (aiService.ts::generateQuestion), now local like everything
    else. Reuses the same fine-tuned interviewer LLM / offline question bank
    as the mock-interview path (get_generator().generate_question).

    No verified local reference answer exists for a freshly generated
    question (the runtime question bank carries skill/topic/difficulty/
    question only, not an answer key) - "answer" is intentionally left blank
    here rather than fabricated. See docs/LOCAL_AI_MIGRATION_AUDIT.md."""
    data = request.json or {}
    topic = (data.get("topic") or "General").strip()
    difficulty = (data.get("difficulty") or "Medium").strip()
    result = get_generator().generate_question(skill=topic, topic=topic, difficulty=difficulty)
    return jsonify(
        {
            "question": result["question"],
            "answer": "",
            "topic": topic,
            "difficulty": difficulty,
            "source": result["source"],
        }
    )


@app.route("/evaluate-answer", methods=["POST"])
@require_auth
def api_evaluate_answer():
    data = request.json
    evaluation = evaluate_answer(
        question=data.get("question", ""),
        answer=data.get("answer", ""),
        interview_type=data.get("interviewType", "Technical"),
        difficulty=data.get("difficulty", "Medium"),
        job_role=data.get("jobRole", ""),
        skill=data.get("skill", ""),
        topic=data.get("topic", ""),
        concepts=data.get("concepts") or None,
        answer_type=data.get("answerType") or "text",
        speech=data.get("speech") or None,
        time_taken=data.get("timeTaken") or 0,
    )
    return jsonify({"evaluation": evaluation})


@app.route("/generate-feedback", methods=["POST"])
@require_auth
def api_generate_feedback():
    data = request.json
    feedback = generate_feedback(
        scores=data.get("scores", {}),
        strengths=data.get("strengths", []),
        weaknesses=data.get("weaknesses", []),
        job_role=data.get("jobRole", ""),
    )
    return jsonify({"feedback": feedback})


@app.route("/resume-model-status", methods=["GET"])
def resume_model_status():
    enhancer = get_enhancer()
    return jsonify(
        {
            "model_loaded": enhancer.is_loaded,
            "load_error": enhancer._load_error,
            "last_load_time_ms": enhancer.last_load_time_ms,
            "requires_api_key": False,
        }
    )


@app.route("/enhance-resume-content", methods=["POST"])
@require_auth
def api_enhance_resume_content():
    data = request.json
    enhancement_type = data.get("type", "")
    context = data.get("context", {})
    if enhancement_type not in ("summary", "bullet"):
        return jsonify({"error": "type must be 'summary' or 'bullet'"}), 400

    enhanced_text = enhance_resume_content(enhancement_type, context)
    if not enhanced_text:
        return jsonify({"error": "Could not enhance content"}), 500
    return jsonify({"enhanced_text": enhanced_text})


@app.route("/classify-resume-category", methods=["POST"])
@require_auth
def api_classify_resume_category():
    data = request.json or {}
    text = data.get("resume_text", "")
    if not text or not text.strip():
        return jsonify({"error": "resume_text is required"}), 400

    result = classify_resume_category(text)
    if result is None:
        # Model artifacts missing/failed to load - not a request error, just
        # an unavailable optional signal. Caller should proceed without it.
        return jsonify({"available": False}), 200
    return jsonify({"available": True, **result})


@app.route("/text-to-speech", methods=["POST"])
@require_auth
def api_text_to_speech():
    data = request.json
    text = data.get("text", "")
    audio_bytes = text_to_speech(text)
    if audio_bytes:
        return jsonify({"audio": base64.b64encode(audio_bytes).decode("utf-8")})
    return jsonify({"error": "TTS failed"}), 500


@app.route("/speech-to-text", methods=["POST"])
@require_auth
def api_speech_to_text():
    data = request.json
    audio_b64 = data.get("audio", "")
    if not audio_b64:
        return jsonify({"error": "No audio data"}), 400

    audio_bytes = base64.b64decode(audio_b64)
    text = speech_to_text(audio_bytes)
    if text:
        return jsonify({"text": text})
    return jsonify({"error": "STT failed"}), 500


@app.route("/analyze-frame", methods=["POST"])
@require_auth
def api_analyze_frame():
    data = request.json
    image_b64 = data.get("image", "")
    if not image_b64:
        return jsonify({"error": "No image data"}), 400

    image_bytes = base64.b64decode(image_b64)
    np_arr = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if frame is None:
        return jsonify({"error": "Invalid image data"}), 400

    result = analyze_frame(frame)
    return jsonify(result)


@app.route("/tech-questions/technologies", methods=["GET"])
def api_tech_question_technologies():
    engine = get_tech_question_engine()
    if not engine.is_loaded:
        return jsonify({"error": engine.load_error or "Question index not loaded"}), 503
    return jsonify({"technologies": engine.list_technologies()})


@app.route("/tech-questions/select", methods=["POST"])
@require_auth
def api_tech_question_select():
    engine = get_tech_question_engine()
    if not engine.is_loaded:
        return jsonify({"error": engine.load_error or "Question index not loaded"}), 503

    data = request.json or {}
    technology = data.get("technology", "")
    if technology not in engine.list_technologies():
        return jsonify({"error": f"Unsupported technology: {technology}"}), 400

    result = engine.select_questions(
        technology=technology,
        difficulty=data.get("difficulty", "Mixed"),
        count=int(data.get("count", 10)),
        question_types=data.get("questionTypes") or None,
        exclude_ids=data.get("excludeIds") or None,
        topic_weights=data.get("topicWeights") or None,
    )
    return jsonify(result)


@app.route("/tech-questions/evaluate", methods=["POST"])
@require_auth
def api_tech_question_evaluate():
    data = request.json or {}
    question_id = data.get("questionId", "")
    if not question_id:
        return jsonify({"error": "questionId is required"}), 400

    result = evaluate_tech_answer(question_id, data.get("answer"))
    if "error" in result:
        return jsonify(result), 404
    return jsonify(result)


# Fine-tuned study-chatbot matcher (POST /chatbot/match, GET /chatbot/status).
# The model loads lazily on the first request, so start-up is unaffected.
from chatbot.service import register as register_chatbot
register_chatbot(app, require_auth)


@app.route("/cleanup", methods=["POST"])
def cleanup():
    release_resources()
    return jsonify({"status": "cleaned"})


if __name__ == "__main__":
    port = int(os.getenv("AI_SERVICE_PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=False)
