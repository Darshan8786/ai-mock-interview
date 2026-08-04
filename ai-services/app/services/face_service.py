import os
import cv2
import numpy as np
import mediapipe as mp
from dataclasses import dataclass, field
from app.config import settings

mp_image = mp.Image
mp_tasks = mp.tasks.vision
mp_running_mode = mp_tasks.RunningMode

# 3D facial model points in mm (generic head model, MPII / 3DDFA reference)
#   0: Nose tip               (landmark 1)
#   1: Chin                   (landmark 152)
#   2: Left eye left corner   (landmark 33)
#   3: Right eye right corner (landmark 263)
#   4: Left mouth corner      (landmark 61)
#   5: Right mouth corner     (landmark 291)
_3D_MODEL_POINTS = np.array([
    (0.0, 0.0, 0.0),
    (0.0, -330.0, -65.0),
    (-225.0, 170.0, -135.0),
    (225.0, 170.0, -135.0),
    (-150.0, -150.0, -125.0),
    (150.0, -150.0, -125.0),
], dtype=np.float64)

_LANDMARK_INDICES = [1, 152, 33, 263, 61, 291]

YAW_THRESHOLD = 20.0
PITCH_THRESHOLD = 20.0

# Smoothing: weight for current frame (lower = smoother but more lag)
# At 10 FPS, alpha=0.15 means ~85% history → about 6 frames (0.6s) to settle
SMOOTHING_ALPHA = 0.15


@dataclass
class FaceAnalysisResult:
    face_detected: bool = False
    multiple_faces: bool = False
    face_too_far: bool = False
    face_too_close: bool = False
    face_partial: bool = False

    head_yaw: float = 0.0
    head_pitch: float = 0.0
    head_roll: float = 0.0
    head_direction: str = "Center"

    eyes_closed: bool = False
    eye_direction: str = "Center"

    looking_away: bool = False
    warnings: list = field(default_factory=list)


def _model_path(name: str) -> str:
    for ext in [".tflite", ".task"]:
        path = os.path.join(settings.MODEL_DIR, f"{name}{ext}")
        if os.path.exists(path):
            return path
    return os.path.join(settings.MODEL_DIR, f"{name}.tflite")


class FaceDetectionService:
    def __init__(self):
        detector_path = _model_path("face_detector")
        landmarker_path = _model_path("face_landmarker")

        self.detector = None
        self.landmarker = None

        if os.path.exists(detector_path):
            self.detector = mp_tasks.FaceDetector.create_from_options(
                mp_tasks.FaceDetectorOptions(
                    base_options=mp.tasks.BaseOptions(model_asset_path=detector_path),
                    running_mode=mp_running_mode.IMAGE,
                    min_detection_confidence=settings.FACE_CONFIDENCE_THRESHOLD,
                )
            )

        if os.path.exists(landmarker_path):
            self.landmarker = mp_tasks.FaceLandmarker.create_from_options(
                mp_tasks.FaceLandmarkerOptions(
                    base_options=mp.tasks.BaseOptions(model_asset_path=landmarker_path),
                    running_mode=mp_running_mode.IMAGE,
                    min_face_detection_confidence=settings.FACE_CONFIDENCE_THRESHOLD,
                    min_tracking_confidence=0.5,
                    output_face_blendshapes=False,
                    output_facial_transformation_matrixes=False,
                )
            )

        self.look_away_counter = 0
        self.eye_closed_counter = 0
        self.look_away_threshold = settings.LOOK_AWAY_FRAMES
        self.eye_closed_threshold = settings.EYE_CLOSED_FRAMES

        # Temporal smoothing state
        self.smoothed_yaw = None
        self.smoothed_pitch = None
        self.smoothed_roll = None

    # ─── 3D Head Pose Estimation (solvePnP) ──────────────────────────

    def _estimate_head_pose(self, landmarks, frame_w: int, frame_h: int):
        """Recover yaw / pitch / roll (degrees) via OpenCV solvePnP.

        Conventions
        -----------
        Yaw   (+) looking right    (-) looking left
        Pitch (+) looking down     (-) looking up
        Roll  (+) tilted right     (-) tilted left
        """
        image_points = np.array([
            (landmarks[idx].x * frame_w, landmarks[idx].y * frame_h)
            for idx in _LANDMARK_INDICES
        ], dtype=np.float64)

        focal_length = frame_w
        cx, cy = frame_w / 2.0, frame_h / 2.0

        camera_matrix = np.array([
            [focal_length, 0, cx],
            [0, focal_length, cy],
            [0, 0, 1],
        ], dtype=np.float64)

        dist_coeffs = np.zeros((4, 1), dtype=np.float64)

        try:
            _, rvec, _ = cv2.solvePnP(
                _3D_MODEL_POINTS, image_points, camera_matrix, dist_coeffs,
                flags=cv2.SOLVEPNP_EPNP,
            )
        except cv2.error:
            return 0.0, 0.0, 0.0

        rmat, _ = cv2.Rodrigues(rvec)

        sy = np.sqrt(rmat[0, 0] ** 2 + rmat[1, 0] ** 2)
        singular = sy < 1e-6

        if not singular:
            x = np.arctan2(rmat[2, 1], rmat[2, 2])
            y = np.arctan2(-rmat[2, 0], sy)
            z = np.arctan2(rmat[1, 0], rmat[0, 0])
        else:
            x = np.arctan2(-rmat[1, 2], rmat[1, 1])
            y = np.arctan2(-rmat[2, 0], sy)
            z = 0.0

        return float(np.degrees(y)), float(np.degrees(x)), float(np.degrees(z))

    def _apply_smoothing(self, yaw: float, pitch: float, roll: float):
        if self.smoothed_yaw is None:
            self.smoothed_yaw = yaw
            self.smoothed_pitch = pitch
            self.smoothed_roll = roll
        else:
            a = SMOOTHING_ALPHA
            self.smoothed_yaw = a * yaw + (1 - a) * self.smoothed_yaw
            self.smoothed_pitch = a * pitch + (1 - a) * self.smoothed_pitch
            self.smoothed_roll = a * roll + (1 - a) * self.smoothed_roll
        return self.smoothed_yaw, self.smoothed_pitch, self.smoothed_roll

    def _reset_smoothing(self):
        self.smoothed_yaw = None
        self.smoothed_pitch = None
        self.smoothed_roll = None

    def _direction_from_yaw_pitch(self, yaw: float, pitch: float) -> str:
        if abs(yaw) > YAW_THRESHOLD:
            return "Left" if yaw < 0 else "Right"
        if abs(pitch) > PITCH_THRESHOLD:
            return "Up" if pitch < 0 else "Down"
        return "Center"

    # ─── Face Position (bounding-box sanity) ─────────────────────────

    @staticmethod
    def _check_face_position(detections, frame_w: int, frame_h: int) -> list:
        warnings = []
        if not detections:
            return warnings
        bbox = detections[0].bounding_box
        face_ratio = (bbox.width * bbox.height) / (frame_w * frame_h)
        if face_ratio < 0.01:
            warnings.append("Face too far")
        elif face_ratio > 0.35:
            warnings.append("Face too close")
        margin = 0.1
        if bbox.origin_x < -margin * frame_w or bbox.origin_x + bbox.width > frame_w * (1 + margin):
            warnings.append("Face partially outside camera")
        if bbox.origin_y < -margin * frame_h or bbox.origin_y + bbox.height > frame_h * (1 + margin):
            warnings.append("Face partially outside camera")
        return warnings

    # ─── Eye State (EAR blink + yaw-derived gaze) ─────────────────────

    @staticmethod
    def _compute_eye_state(landmarks_result, yaw: float):
        eyes_closed = False
        gaze_dir = "Center"

        if not landmarks_result or not landmarks_result.face_landmarks:
            return eyes_closed, gaze_dir

        lm = landmarks_result.face_landmarks[0]

        def ear(indices):
            pts = np.array([[lm[i].x, lm[i].y] for i in indices])
            return (np.linalg.norm(pts[1] - pts[5]) + np.linalg.norm(pts[2] - pts[4])) / \
                   (2.0 * np.linalg.norm(pts[0] - pts[3]) + 1e-6)

        left_ear = ear([33, 160, 158, 133, 153, 144])
        right_ear = ear([362, 385, 387, 263, 373, 380])
        avg_ear = (left_ear + right_ear) / 2.0
        eyes_closed = bool(avg_ear < 0.2)

        if yaw > 15.0:
            gaze_dir = "Left"
        elif yaw < -15.0:
            gaze_dir = "Right"
        else:
            gaze_dir = "Center"

        return eyes_closed, gaze_dir

    # ─── Main Entry Point ────────────────────────────────────────────

    def analyze(self, frame: np.ndarray) -> FaceAnalysisResult:
        result = FaceAnalysisResult()
        if frame is None:
            result.warnings.append("No frame received")
            return result

        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_frame = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

        if self.detector is None:
            result.warnings.append("Face detection model not loaded")
            return result

        det_result = self.detector.detect(mp_frame)
        detections = det_result.detections if det_result else []

        if not detections:
            self.look_away_counter += 1
            self._reset_smoothing()
            result.warnings.append("No face visible")
            if self.look_away_counter >= self.look_away_threshold:
                result.looking_away = True
                result.warnings.append("Please look at the screen")
            return result

        self.look_away_counter = 0
        result.face_detected = True

        if len(detections) > 1:
            result.multiple_faces = True
            result.warnings.append("Multiple people detected")

        for pw in self._check_face_position(detections, w, h):
            if "too far" in pw:
                result.face_too_far = True
            elif "too close" in pw:
                result.face_too_close = True
            elif "outside" in pw:
                result.face_partial = True
            result.warnings.append(pw)

        # ── Head pose + eye state via landmarks ──────────────────────
        if self.landmarker is not None:
            try:
                lm_result = self.landmarker.detect(mp_frame)
                if lm_result and lm_result.face_landmarks:
                    landmarks = lm_result.face_landmarks[0]

                    # 3D head pose (raw solvePnP)
                    yaw, pitch, roll = self._estimate_head_pose(landmarks, w, h)

                    # Temporal smoothing to kill jitter
                    yaw, pitch, roll = self._apply_smoothing(yaw, pitch, roll)
                    result.head_yaw = yaw
                    result.head_pitch = pitch
                    result.head_roll = roll

                    direction = self._direction_from_yaw_pitch(yaw, pitch)
                    result.head_direction = direction

                    if direction != "Center":
                        result.warnings.append(f"Looking {direction.lower()}")

                    # Eye state (EAR + gaze from yaw)
                    eyes_closed, gaze_dir = self._compute_eye_state(lm_result, yaw)
                    result.eyes_closed = eyes_closed
                    result.eye_direction = gaze_dir

                    if eyes_closed:
                        result.warnings.append("Eyes closed")
                        self.eye_closed_counter += 1
                        if self.eye_closed_counter >= self.eye_closed_threshold:
                            result.warnings.append("Please stay attentive")
                    else:
                        self.eye_closed_counter = 0

                    # Continuous off-center → looking_away
                    if direction != "Center":
                        self.look_away_counter += 1
                        if self.look_away_counter >= self.look_away_threshold:
                            result.looking_away = True
                            result.warnings.append("Please look at the screen")
                    else:
                        self.look_away_counter = 0
                else:
                    self._reset_smoothing()

            except Exception:
                self._reset_smoothing()

        return result

    def release(self):
        if self.detector:
            self.detector.close()
        if self.landmarker:
            self.landmarker.close()
