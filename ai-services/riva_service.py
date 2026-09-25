import os
import io
import wave
import tempfile
import threading
from typing import Optional

RIVA_ENABLED = os.getenv("RIVA_ENABLED", "false").lower() == "true"
RIVA_SERVER = os.getenv("RIVA_SERVER", "localhost:50051")

# Local, offline speech-to-text (faster-whisper, CPU, int8) - the default
# (RIVA_ENABLED=false) STT path. Loaded lazily once per process and reused;
# WHISPER_MODEL_SIZE picks the tradeoff (tiny/base/small/medium/large-v3).
# No external API, no API key, no network call.
_whisper_model = None
_whisper_lock = threading.Lock()


def _get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        with _whisper_lock:
            if _whisper_model is None:
                from faster_whisper import WhisperModel
                size = os.getenv("WHISPER_MODEL_SIZE", "base")
                _whisper_model = WhisperModel(size, device="cpu", compute_type="int8")
    return _whisper_model

try:
    if RIVA_ENABLED:
        import riva.client
        import riva.client.audio_io
except ImportError:
    RIVA_ENABLED = False


def text_to_speech(text: str, language: str = "en-US") -> Optional[bytes]:
    if not RIVA_ENABLED:
        return _fallback_tts(text)

    try:
        auth = riva.client.Auth(uri=RIVA_SERVER)
        client = riva.client.SpeechService(auth)
        resp = client.synthesize(
            text,
            language_code=language,
            voice_name="en-US-Wavenet-D",
            encoding=riva.client.AudioEncoding.LINEAR_PCM,
        )
        return resp.audio
    except Exception as e:
        print(f"Riva TTS error: {e}")
        return _fallback_tts(text)


def speech_to_text(audio_bytes: bytes, language: str = "en-US") -> Optional[str]:
    if not RIVA_ENABLED:
        return _fallback_stt(audio_bytes)

    try:
        auth = riva.client.Auth(uri=RIVA_SERVER)
        client = riva.client.SpeechService(auth)

        config = riva.client.RecognitionConfig(
            encoding=riva.client.AudioEncoding.LINEAR_PCM,
            sample_rate_hertz=16000,
            language_code=language,
            max_alternatives=1,
            enable_automatic_punctuation=True,
        )

        with io.BytesIO(audio_bytes) as audio_stream:
            responses = client.streaming_recognize(
                config, audio_stream, interim_results=False
            )
            for response in responses:
                if response.results:
                    return response.results[0].alternatives[0].transcript
    except Exception as e:
        print(f"Riva STT error: {e}")
        return _fallback_stt(audio_bytes)

    return None


def _fallback_tts(text: str) -> Optional[bytes]:
    try:
        import pyttsx3
        engine = pyttsx3.init()
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
        engine.save_to_file(text, temp_path)
        engine.runAndWait()
        with open(temp_path, "rb") as f:
            data = f.read()
        os.unlink(temp_path)
        return data
    except ImportError:
        pass

    try:
        import subprocess
        import platform
        system = platform.system()
        temp_path = os.path.join(tempfile.gettempdir(), "tts_output.wav")

        if system == "Windows":
            import win32com.client
            speaker = win32com.client.Dispatch("SAPI.SpVoice")
            stream = win32com.client.Dispatch("SAPI.SpFileStream")
            from win32com.client import constants
            stream.Open(temp_path, constants.SSSFMCreateForWrite)
            speaker.AudioOutputStream = stream
            speaker.Speak(text)
            stream.Close()
            with open(temp_path, "rb") as f:
                return f.read()
    except Exception as e:
        print(f"Fallback TTS error: {e}")

    return None


def _fallback_stt(audio_bytes: bytes) -> Optional[str]:
    """Transcribes the given audio locally with faster-whisper (CPU, int8).
    Replaces the previous implementation, which ignored `audio_bytes` entirely
    and instead recorded from the server's own microphone via
    speech_recognition.Microphone(), then sent that recording to Google's
    cloud Web Speech API (recognize_google) - never transcribing the
    candidate's actual answer, and calling an external service to boot.
    faster-whisper decodes webm/opus (the format the frontend records)
    directly via PyAV - no ffmpeg install, no network call required."""
    if not audio_bytes:
        return None
    try:
        model = _get_whisper_model()
        segments, _info = model.transcribe(io.BytesIO(audio_bytes), language="en", beam_size=1)
        text = " ".join(seg.text.strip() for seg in segments).strip()
        return text or None
    except Exception as e:
        print(f"Local STT (faster-whisper) error: {e}")
        return None
