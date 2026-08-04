import base64
import cv2
import numpy as np
from app.config import settings


def decode_base64_to_frame(base64_str: str) -> np.ndarray | None:
    try:
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]
        img_bytes = base64.b64decode(base64_str)
        np_arr = np.frombuffer(img_bytes, dtype=np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        return frame
    except Exception:
        return None


def compress_frame(frame: np.ndarray, max_size: int = None) -> np.ndarray:
    if max_size is None:
        max_size = settings.MAX_FRAME_SIZE
    h, w = frame.shape[:2]
    if max(h, w) > max_size:
        scale = max_size / max(h, w)
        new_w, new_h = int(w * scale), int(h * scale)
        return cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return frame


def encode_frame_to_base64(frame: np.ndarray, quality: int = 85) -> str:
    _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.b64encode(buffer).decode("utf-8")


def frame_to_bytes(frame: np.ndarray, format: str = ".jpg", quality: int = 85) -> bytes:
    if format == ".jpg":
        _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    else:
        _, buffer = cv2.imencode(format, frame)
    return buffer.tobytes()
