import os
import logging
import numpy as np
import cv2
from typing import Optional
from app.config import settings
from app.models.downloader import download_insightface

logger = logging.getLogger(__name__)


class FaceVerificationService:
    def __init__(self):
        self.model = None
        self.reference_embedding: Optional[np.ndarray] = None
        self._init_model()

    def _init_model(self):
        try:
            import insightface
            from insightface.app import FaceAnalysis
            model_path = os.path.join(settings.MODEL_DIR, "buffalo_l")
            if not os.path.exists(model_path):
                logger.info("InsightFace model not found, downloading...")
                model_path = download_insightface()
            if model_path and os.path.exists(model_path):
                self.model = FaceAnalysis(
                    name="buffalo_l",
                    root=settings.MODEL_DIR,
                    providers=["CPUExecutionProvider"],
                )
                self.model.prepare(ctx_id=0, det_thresh=settings.FACE_CONFIDENCE_THRESHOLD)
                logger.info("InsightFace model loaded successfully")
            else:
                logger.warning("InsightFace model not available, face verification disabled")
        except ImportError:
            logger.warning("insightface not installed, verification disabled")
        except Exception as e:
            logger.warning(f"Failed to load InsightFace: {e}")

    def capture_reference(self, frame: np.ndarray) -> bool:
        if self.model is None or frame is None:
            return False
        try:
            faces = self.model.get(frame)
            if len(faces) == 0:
                logger.warning("No face found for reference capture")
                return False
            self.reference_embedding = faces[0].embedding.copy()
            logger.info("Reference face embedding captured")
            return True
        except Exception as e:
            logger.warning(f"Failed to capture reference face: {e}")
            return False

    def verify(self, frame: np.ndarray, threshold: float = 0.5) -> dict:
        result = {
            "verified": True,
            "mismatch": False,
            "similarity": 1.0,
            "warnings": [],
        }
        if self.model is None or self.reference_embedding is None:
            result["warnings"].append("Face verification not available")
            return result
        if frame is None:
            result["warnings"].append("No frame for verification")
            return result

        try:
            faces = self.model.get(frame)
            if len(faces) == 0:
                result["verified"] = False
                result["warnings"].append("No face visible for verification")
                return result

            if len(faces) > 1:
                result["warnings"].append("Multiple faces detected during verification")

            current_embedding = faces[0].embedding
            similarity = np.dot(self.reference_embedding, current_embedding) / (
                np.linalg.norm(self.reference_embedding) * np.linalg.norm(current_embedding) + 1e-6
            )
            similarity = float(max(0, min(1, similarity)))

            result["similarity"] = similarity
            if similarity < threshold:
                result["verified"] = False
                result["mismatch"] = True
                result["warnings"].append("Identity mismatch detected")

        except Exception as e:
            logger.warning(f"Face verification error: {e}")
            result["warnings"].append("Verification error")

        return result

    def has_reference(self) -> bool:
        return self.reference_embedding is not None

    def reset(self):
        self.reference_embedding = None
