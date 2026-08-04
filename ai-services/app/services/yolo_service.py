import os
import logging
import numpy as np
from typing import Optional
from app.config import settings
from app.models.downloader import download_yolo

logger = logging.getLogger(__name__)

COCO_CLASSES = {
    0: "person",
    67: "cell phone",
}


class YOLODetectionService:
    def __init__(self):
        self.model = None
        self._init_model()

    def _init_model(self):
        try:
            from ultralytics import YOLO
            weights_path = os.path.join(settings.WEIGHTS_DIR, "yolo11n.pt")
            if not os.path.exists(weights_path):
                logger.info("YOLO weights not found, downloading...")
                weights_path = download_yolo("yolov11n")
            if weights_path and os.path.exists(weights_path):
                self.model = YOLO(weights_path)
                logger.info("YOLOv11 model loaded successfully")
            else:
                logger.warning("YOLO weights not available, phone/person detection disabled")
        except ImportError:
            logger.warning("ultralytics not installed, YOLO detection disabled")
        except Exception as e:
            logger.warning(f"Failed to load YOLO model: {e}")

    def detect(self, frame: np.ndarray, conf_threshold: float = 0.4):
        result = {
            "persons": 0,
            "multiple_persons": False,
            "phone_detected": False,
            "phone_confidence": 0.0,
        }
        if self.model is None:
            return result

        try:
            dets = self.model(frame, conf=conf_threshold, verbose=False)
            if not dets:
                return result

            boxes = dets[0].boxes
            if boxes is None or len(boxes) == 0:
                return result

            for box in boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                label = COCO_CLASSES.get(cls_id, "")

                if label == "person":
                    result["persons"] += 1
                elif label == "cell phone":
                    result["phone_detected"] = True
                    result["phone_confidence"] = max(result["phone_confidence"], conf)

            result["multiple_persons"] = result["persons"] > 1

        except Exception as e:
            logger.warning(f"YOLO inference error: {e}")

        return result
