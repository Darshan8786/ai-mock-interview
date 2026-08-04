import os
import logging
import urllib.request
import zipfile
from pathlib import Path
from app.config import settings

logger = logging.getLogger(__name__)

MODEL_URLS = {
    "yolov11n": "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11n.pt",
    "yolov11s": "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11s.pt",
    "face_detector": "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
    "face_landmarker": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
    "face_detector": "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
    "insightface": "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip",
}


def ensure_dir(path: str):
    Path(path).mkdir(parents=True, exist_ok=True)


def download_file(url: str, dest_path: str):
    if os.path.exists(dest_path):
        logger.info(f"Already exists: {dest_path}")
        return
    logger.info(f"Downloading {url} -> {dest_path}")
    try:
        urllib.request.urlretrieve(url, dest_path)
        logger.info(f"Downloaded: {dest_path}")
    except Exception as e:
        logger.warning(f"Failed to download {url}: {e}")


def download_yolo(model_name: str = "yolov11n"):
    ensure_dir(settings.WEIGHTS_DIR)
    url = MODEL_URLS.get(model_name)
    if not url:
        logger.warning(f"Unknown model: {model_name}")
        return
    dest = os.path.join(settings.WEIGHTS_DIR, f"{model_name}.pt")
    download_file(url, dest)
    return dest


def download_face_models():
    ensure_dir(settings.MODEL_DIR)
    for key in ["face_detector", "face_landmarker"]:
        url = MODEL_URLS.get(key)
        if not url:
            continue
        dest = os.path.join(settings.MODEL_DIR, f"{key}.tflite")
        download_file(url, dest)
    return settings.MODEL_DIR


def download_insightface():
    ensure_dir(settings.MODEL_DIR)
    url = MODEL_URLS.get("insightface")
    if not url:
        return
    zip_path = os.path.join(settings.MODEL_DIR, "buffalo_l.zip")
    extract_path = os.path.join(settings.MODEL_DIR, "buffalo_l")
    if os.path.exists(extract_path):
        logger.info(f"InsightFace model already exists at {extract_path}")
        return extract_path
    download_file(url, zip_path)
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(extract_path)
        os.remove(zip_path)
        logger.info(f"Extracted InsightFace model to {extract_path}")
    except Exception as e:
        logger.warning(f"Failed to extract InsightFace model: {e}")
    return extract_path


def download_all_models():
    logger.info("Checking and downloading required models...")
    download_face_models()
    download_yolo("yolov11n")
    download_insightface()
    logger.info("Model check complete.")
