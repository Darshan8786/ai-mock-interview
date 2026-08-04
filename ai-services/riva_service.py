import os
import io
import wave
import tempfile
from typing import Optional

RIVA_ENABLED = os.getenv("RIVA_ENABLED", "false").lower() == "true"
RIVA_SERVER = os.getenv("RIVA_SERVER", "localhost:50051")

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
        return _fallback_stt()

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
        return _fallback_stt()

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


def _fallback_stt() -> Optional[str]:
    try:
        import speech_recognition as sr
        recognizer = sr.Recognizer()
        with sr.Microphone() as source:
            print("Listening...")
            audio = recognizer.listen(source, timeout=5, phrase_time_limit=15)
        try:
            return recognizer.recognize_google(audio)
        except sr.UnknownValueError:
            return "Could not understand audio"
        except sr.RequestError:
            return None
    except ImportError:
        return None
