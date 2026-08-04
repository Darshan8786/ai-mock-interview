import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    PORT: int = int(os.getenv("AI_SERVICE_PORT", "8000"))
    AI_SERVICE_KEY: str = os.getenv("AI_SERVICE_KEY", "mindprep-ai-key-2026")

    NIM_API_URL: str = os.getenv("NIM_API_URL", "https://integrate.api.nvidia.com/v1")
    NIM_API_KEY: str = os.getenv("NIM_API_KEY", "")
    NIM_MODEL: str = os.getenv("NIM_MODEL", "meta/llama-3.1-405b-instruct")

    RIVA_ENABLED: bool = os.getenv("RIVA_ENABLED", "false").lower() == "true"
    RIVA_SERVER: str = os.getenv("RIVA_SERVER", "localhost:50051")

    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017/mindprep")

    MODEL_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
    WEIGHTS_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "weights")

    FACE_CONFIDENCE_THRESHOLD: float = 0.5
    LOOK_AWAY_FRAMES: int = 15
    EYE_CLOSED_FRAMES: int = 10
    VERIFICATION_INTERVAL: int = 5
    MAX_FRAME_SIZE: int = 640


settings = Settings()
