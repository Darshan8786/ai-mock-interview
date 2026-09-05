import os
import time
import threading
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks.python.vision import FaceLandmarker, FaceLandmarkerOptions
from mediapipe.tasks.python.core.base_options import BaseOptions
from typing import Dict, List, Any
try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None

class ProctoringEngine:
    def __init__(self):
        # MediaPipe FaceLandmarker (Tasks API) for head pose and face counting
        # This is compatible with Python 3.14 and mediapipe 0.10.x
        model_path = os.path.join(os.path.dirname(__file__), "..", "..", "face_landmarker.task")
        
        # Download the model if it doesn't exist
        if not os.path.exists(model_path):
            import urllib.request
            print("Downloading face_landmarker.task...")
            urllib.request.urlretrieve(
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                model_path
            )
            
        options = FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=model_path),
            num_faces=5
        )
        self.landmarker = FaceLandmarker.create_from_options(options)


        # Load YOLO model if available
        self.yolo_model = None
        model_path = os.path.join("models", "proctor_yolo", "weights", "best.pt")
        if YOLO and os.path.exists(model_path):
            try:
                self.yolo_model = YOLO(model_path)
                print("Loaded custom YOLO model for proctoring.")
            except Exception as e:
                print(f"Failed to load YOLO model: {e}")

        # Configurable settings
        self.LOOKING_AWAY_THRESHOLD_DEG = 20 # degrees
        
        # Temporal state tracking (session_id -> state)
        self.sessions = {}

        # process_frame() now runs in a worker thread (see routes/proctor.py).
        # MediaPipe's detect() and the Ultralytics model are not safe to call
        # concurrently on one instance, and self.sessions is a plain dict, so
        # serialize the whole per-frame analysis. This never blocks the event
        # loop - only overlapping frames wait on each other.
        self._lock = threading.Lock()

    def warmup(self) -> None:
        """Run one throwaway inference so the first *real* interview frame is
        fast. MediaPipe builds its graph and Ultralytics fuses/JITs the YOLO
        model lazily on the first call - without this the first frame of an
        interview can take several seconds, long enough for the client
        watchdog to give up and drop back to "Connecting to proctoring...".
        Uses random noise (not a black frame, which trips the obstruction
        short-circuit and skips both model passes)."""
        try:
            noise = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
            self.process_frame("__warmup__", noise)
        except Exception as e:
            print(f"ProctoringEngine warmup failed (non-fatal): {e}")
        finally:
            self.sessions.pop("__warmup__", None)
        print("ProctoringEngine warmup complete.")

    def get_session(self, session_id: str) -> dict:
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "no_face_start": None,
                "multi_face_start": None,
                "looking_away_start": None,
                "obstruction_start": None,
                "last_violation_time": 0,

                # Configurable Durations (seconds)
                "NO_FACE_DURATION": 2.0,
                "MULTIPLE_FACE_DURATION": 1.0,
                "LOOKING_AWAY_DURATION": 2.0,
                "OBSTRUCTION_DURATION": 2.0,
                "VIOLATION_COOLDOWN": 5.0,
                "CONFIDENCE_THRESHOLD": 0.6
            }
        return self.sessions[session_id]

    @staticmethod
    def is_camera_obstructed(frame: np.ndarray) -> bool:
        """Detect a covered lens or a static/blank object held over the
        camera. A real scene (face + background) always has meaningful
        pixel variance; a covered/blocked lens is near-uniform in both
        brightness and texture regardless of what's covering it."""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        mean_brightness = float(np.mean(gray))
        std_dev = float(np.std(gray))
        return mean_brightness < 15.0 or std_dev < 8.0

    def calculate_head_pose(self, image, face_landmarks):
        img_h, img_w, _ = image.shape
        face_3d = []
        face_2d = []

        # Relevant landmarks for pose estimation
        lm_indices = [33, 263, 1, 61, 291, 199]
        for idx in lm_indices:
            # FaceLandmarker uses a list directly, not a wrapper object
            lm = face_landmarks[idx]
            x, y = int(lm.x * img_w), int(lm.y * img_h)
            face_2d.append([x, y])
            face_3d.append([x, y, lm.z])

        face_2d = np.array(face_2d, dtype=np.float64)
        face_3d = np.array(face_3d, dtype=np.float64)

        focal_length = 1 * img_w
        cam_matrix = np.array([[focal_length, 0, img_h / 2],
                               [0, focal_length, img_w / 2],
                               [0, 0, 1]])
        dist_matrix = np.zeros((4, 1), dtype=np.float64)

        try:
            success, rot_vec, trans_vec = cv2.solvePnP(face_3d, face_2d, cam_matrix, dist_matrix)
            rmat, _ = cv2.Rodrigues(rot_vec)
            angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
        except cv2.error:
            # Degenerate point set — treat as facing forward rather than
            # letting the exception kill the whole frame analysis.
            return "forward"

        x, y, z = angles[0] * 360, angles[1] * 360, angles[2] * 360

        direction = "forward"
        if y < -self.LOOKING_AWAY_THRESHOLD_DEG:
            direction = "left"
        elif y > self.LOOKING_AWAY_THRESHOLD_DEG:
            direction = "right"
        elif x < -self.LOOKING_AWAY_THRESHOLD_DEG:
            direction = "down"
        elif x > self.LOOKING_AWAY_THRESHOLD_DEG:
            direction = "up"
            
        return direction

    def process_frame(self, session_id: str, frame: np.ndarray) -> Dict[str, Any]:
        with self._lock:
            return self._process_frame(session_id, frame)

    def _process_frame(self, session_id: str, frame: np.ndarray) -> Dict[str, Any]:
        state = self.get_session(session_id)
        current_time = time.time()
        is_cooldown = (current_time - state["last_violation_time"]) < state["VIOLATION_COOLDOWN"]

        # 0. Camera obstruction check - cheap, runs before the expensive
        # MediaPipe/YOLO passes so a blocked lens skips inference entirely
        # instead of burning CPU analyzing a blank frame.
        obstructed = self.is_camera_obstructed(frame)

        if obstructed:
            violations = []
            if not state["obstruction_start"]:
                state["obstruction_start"] = current_time
            elif (current_time - state["obstruction_start"]) > state["OBSTRUCTION_DURATION"]:
                if not is_cooldown:
                    violations.append({
                        "type": "CAMERA_OBSTRUCTED",
                        "message": "Camera appears to be covered or blocked",
                        "severity": "high",
                        "timestamp": current_time
                    })
                    state["last_violation_time"] = current_time

            # Obstruction already explains the missing face - don't also
            # accumulate a separate NO_FACE timer while it's active.
            state["no_face_start"] = None
            state["multi_face_start"] = None
            state["looking_away_start"] = None

            return {
                "faceCount": 0,
                "faceStatus": "none",
                "lookingAway": False,
                "lookingDirection": "forward",
                "mobilePhone": False,
                "headset": False,
                "cameraObstructed": True,
                "analysisDegraded": False,
                "violations": violations
            }

        state["obstruction_start"] = None

        # Any failure in the inference passes below must still yield a result the
        # client can render — a silently swallowed frame is what makes the UI
        # show "Monitoring paused" indefinitely.
        analysis_degraded = False

        # 1. MediaPipe Processing (Faces & Pose)
        face_count = 0
        looking_direction = "forward"
        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            mp_results = self.landmarker.detect(mp_image)

            if mp_results.face_landmarks:
                face_count = len(mp_results.face_landmarks)
                # Calculate pose for the primary face (index 0)
                looking_direction = self.calculate_head_pose(frame, mp_results.face_landmarks[0])
        except Exception as e:
            analysis_degraded = True
            print(f"MediaPipe pass failed for {session_id}: {e}")

        # 2. YOLO Processing (Objects)
        mobile_phone = False
        headset = False

        if self.yolo_model:
            try:
                yolo_results = self.yolo_model(frame, verbose=False)
                for r in yolo_results:
                    for box in r.boxes:
                        if float(box.conf) > state["CONFIDENCE_THRESHOLD"]:
                            cls_id = int(box.cls)
                            # Assuming 0=mobile_phone, 1=headset
                            if cls_id == 0:
                                mobile_phone = True
                            elif cls_id == 1:
                                headset = True
            except Exception as e:
                analysis_degraded = True
                print(f"YOLO pass failed for {session_id}: {e}")

        # 3. Temporal Violation Logic
        violations = []

        # Handle No Face
        if face_count == 0:
            if not state["no_face_start"]:
                state["no_face_start"] = current_time
            elif (current_time - state["no_face_start"]) > state["NO_FACE_DURATION"]:
                if not is_cooldown:
                    violations.append({
                        "type": "NO_FACE",
                        "message": "No face detected in camera",
                        "severity": "high",
                        "timestamp": current_time
                    })
                    state["last_violation_time"] = current_time
        else:
            state["no_face_start"] = None

        # Handle Multiple Faces
        if face_count > 1:
            if not state["multi_face_start"]:
                state["multi_face_start"] = current_time
            elif (current_time - state["multi_face_start"]) > state["MULTIPLE_FACE_DURATION"]:
                if not is_cooldown:
                    violations.append({
                        "type": "MULTIPLE_FACES",
                        "message": "Multiple faces detected",
                        "severity": "high",
                        "timestamp": current_time
                    })
                    state["last_violation_time"] = current_time
        else:
            state["multi_face_start"] = None

        # Handle Looking Away
        if looking_direction != "forward" and face_count == 1:
            if not state["looking_away_start"]:
                state["looking_away_start"] = current_time
            elif (current_time - state["looking_away_start"]) > state["LOOKING_AWAY_DURATION"]:
                if not is_cooldown:
                    violations.append({
                        "type": "LOOKING_AWAY",
                        "message": f"Looking away from screen ({looking_direction})",
                        "severity": "medium",
                        "timestamp": current_time
                    })
                    state["last_violation_time"] = current_time
        else:
            state["looking_away_start"] = None

        # Handle Objects (Instant triggers with cooldown)
        if mobile_phone and not is_cooldown:
            violations.append({
                "type": "MOBILE_PHONE",
                "message": "Mobile phone detected",
                "severity": "high",
                "timestamp": current_time
            })
            state["last_violation_time"] = current_time
            
        if headset and not is_cooldown:
            violations.append({
                "type": "HEADSET",
                "message": "Headset detected",
                "severity": "medium",
                "timestamp": current_time
            })
            state["last_violation_time"] = current_time

        return {
            "faceCount": face_count,
            "faceStatus": "normal" if face_count == 1 else ("none" if face_count == 0 else "multiple"),
            "lookingAway": looking_direction != "forward",
            "lookingDirection": looking_direction,
            "mobilePhone": mobile_phone,
            "headset": headset,
            "cameraObstructed": False,
            "analysisDegraded": analysis_degraded,
            "violations": violations
        }
