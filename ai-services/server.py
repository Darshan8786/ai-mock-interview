import os
import json
import base64
import io
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import cv2

from nim_service import generate_questions, evaluate_answer, generate_feedback
from riva_service import text_to_speech, speech_to_text
from face_detection import analyze_frame, release_resources

app = Flask(__name__)
CORS(app)

AI_SERVICE_KEY = os.getenv("AI_SERVICE_KEY", "mindprep-ai-key-2026")


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


@app.route("/generate-questions", methods=["POST"])
@require_auth
def api_generate_questions():
    data = request.json
    questions = generate_questions(
        job_role=data.get("jobRole", ""),
        experience_level=data.get("experienceLevel", ""),
        interview_type=data.get("interviewType", "Technical"),
        difficulty=data.get("difficulty", "Medium"),
        total_questions=data.get("totalQuestions", 5),
    )
    return jsonify({"questions": questions})


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


@app.route("/cleanup", methods=["POST"])
def cleanup():
    release_resources()
    return jsonify({"status": "cleaned"})


if __name__ == "__main__":
    port = int(os.getenv("AI_SERVICE_PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
