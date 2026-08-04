import os
from typing import Optional

import numpy as np

try:
    import cv2
except ImportError:  # pragma: no cover - optional dependency
    cv2 = None

try:
    import mediapipe as mp
except Exception:  # pragma: no cover - optional dependency
    mp = None

mp_face_mesh = None
mp_face_detection = None
face_mesh = None
face_detection = None

if mp is not None and hasattr(mp, "solutions"):
    mp_face_mesh = mp.solutions.face_mesh
    mp_face_detection = mp.solutions.face_detection

    face_mesh = mp_face_mesh.FaceMesh(
        max_num_faces=2,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    face_detection = mp_face_detection.FaceDetection(
        model_selection=0, min_detection_confidence=0.5
    )

LOOKING_AWAY_FRAMES_THRESHOLD = 75  # ~5 seconds at 15 fps
frame_count = 0
looking_away_start: Optional[int] = None


def analyze_frame(frame: np.ndarray) -> dict:
    global frame_count, looking_away_start
    frame_count += 1

    result = {
        "face_detected": False,
        "multiple_faces": False,
        "looking_direction": "center",
        "looking_away": False,
        "person_left": False,
        "warnings": [],
    }

    if cv2 is None or face_detection is None or face_mesh is None:
        result["warnings"].append("face_detection_unavailable")
        return result

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    h, w = frame.shape[:2]

    detections = face_detection.process(rgb)

    if detections.detections:
        num_faces = len(detections.detections)
        result["face_detected"] = True

        if num_faces > 1:
            result["multiple_faces"] = True
            result["warnings"].append("multiple_faces")
        else:
            bbox = detections.detections[0].location_data.relative_bounding_box
            cx = bbox.xmin + bbox.width / 2

            if cx < 0.3:
                result["looking_direction"] = "left"
            elif cx > 0.7:
                result["looking_direction"] = "right"
            else:
                result["looking_direction"] = "center"

            if result["looking_direction"] != "center":
                if looking_away_start is None:
                    looking_away_start = frame_count
                elif frame_count - looking_away_start >= LOOKING_AWAY_FRAMES_THRESHOLD:
                    result["looking_away"] = True
                    result["warnings"].append("looking_away")
            else:
                looking_away_start = None
    else:
        result["face_detected"] = False
        result["warnings"].append("face_not_visible")
        result["person_left"] = True
        looking_away_start = None

    mesh_results = face_mesh.process(rgb)
    if mesh_results.multi_face_landmarks and len(mesh_results.multi_face_landmarks) == 1:
        landmarks = mesh_results.multi_face_landmarks[0].landmark

        nose_tip = landmarks[1]
        left_eye = landmarks[33]
        right_eye = landmarks[263]
        chin = landmarks[152]

        nose_x = nose_tip.x
        left_eye_x = left_eye.x
        right_eye_x = right_eye.x

        if nose_x < left_eye_x - 0.02:
            result["looking_direction"] = "left"
            result["warnings"].append("looking_left")
        elif nose_x > right_eye_x + 0.02:
            result["looking_direction"] = "right"
            result["warnings"].append("looking_right")

        nose_y = nose_tip.y
        chin_y = chin.y
        if chin_y - nose_y > 0.25:
            result["looking_direction"] = "down"
            result["warnings"].append("looking_down")

    return result


def release_resources():
    if face_mesh is not None:
        face_mesh.close()
    if face_detection is not None:
        face_detection.close()
    if cv2 is not None:
        cv2.destroyAllWindows()
