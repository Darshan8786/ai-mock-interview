import asyncio
import json
import logging
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Header
from app.config import settings
from app.utils.frame_utils import decode_base64_to_frame, compress_frame
from app.services.face_service import FaceDetectionService
from app.services.yolo_service import YOLODetectionService
from app.services.verification_service import FaceVerificationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/proctor", tags=["proctor"])

executor = ThreadPoolExecutor(max_workers=4)

face_service = FaceDetectionService()
yolo_service = YOLODetectionService()
verification_service = FaceVerificationService()

reference_captured = False


def _to_native(obj):
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, dict):
        return {k: _to_native(v) for k, v in obj.items()}
    return obj


def verify_auth(service_key: str = Header(None, alias="X-AI-Service-Key")):
    if service_key != settings.AI_SERVICE_KEY:
        raise HTTPException(status_code=403, detail="Invalid service key")


def analyze_frame_sync(base64_frame: str) -> dict:
    frame = decode_base64_to_frame(base64_frame)
    if frame is None:
        return {"error": "Invalid frame"}

    frame = compress_frame(frame)

    face_result = face_service.analyze(frame)
    yolo_result = yolo_service.detect(frame)

    warnings = list(face_result.warnings)

    if yolo_result["multiple_persons"]:
        warnings.append("Multiple people detected")
    if yolo_result["phone_detected"]:
        warnings.append("Mobile phone detected")

    return _to_native({
        "faceDetected": face_result.face_detected,
        "multipleFaces": face_result.multiple_faces,
        "faceTooFar": face_result.face_too_far,
        "faceTooClose": face_result.face_too_close,
        "facePartial": face_result.face_partial,
        "headDirection": face_result.head_direction,
        "headYaw": face_result.head_yaw,
        "headPitch": face_result.head_pitch,
        "headRoll": face_result.head_roll,
        "eyeDirection": face_result.eye_direction,
        "eyesClosed": face_result.eyes_closed,
        "lookingAway": face_result.looking_away,
        "persons": yolo_result["persons"],
        "multiplePersons": yolo_result["multiple_persons"],
        "phoneDetected": yolo_result["phone_detected"],
        "phoneConfidence": yolo_result["phone_confidence"],
        "warnings": warnings,
        "cheatingCount": len(warnings),
    })


@router.post("/detect-face")
async def detect_face(
    payload: dict,
    auth=Depends(verify_auth),
):
    base64_frame = payload.get("image", "")
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(executor, analyze_frame_sync, base64_frame)
    return result


@router.post("/detect-phone")
async def detect_phone(
    payload: dict,
    auth=Depends(verify_auth),
):
    frame = decode_base64_to_frame(payload.get("image", ""))
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid frame")
    frame = compress_frame(frame)

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(executor, yolo_service.detect, frame)

    return {
        "phoneDetected": result["phone_detected"],
        "confidence": result["phone_confidence"],
        "multiplePersons": result["multiple_persons"],
        "persons": result["persons"],
    }


@router.post("/verify-user")
async def verify_user(
    payload: dict,
    auth=Depends(verify_auth),
):
    global reference_captured
    frame = decode_base64_to_frame(payload.get("image", ""))
    action = payload.get("action", "verify")

    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid frame")
    frame = compress_frame(frame)

    loop = asyncio.get_event_loop()

    if action == "capture":
        success = await loop.run_in_executor(executor, verification_service.capture_reference, frame)
        reference_captured = success
        return {"success": success, "message": "Reference captured" if success else "No face found"}

    if not verification_service.has_reference():
        return {"verified": False, "mismatch": False, "similarity": 0, "warnings": ["No reference captured"]}

    result = await loop.run_in_executor(executor, verification_service.verify, frame)
    return result


@router.post("/headpose")
async def headpose(
    payload: dict,
    auth=Depends(verify_auth),
):
    base64_frame = payload.get("image", "")
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(executor, analyze_frame_sync, base64_frame)
    return {
        "headDirection": result["headDirection"],
        "yaw": result["headYaw"],
        "pitch": result["headPitch"],
        "roll": result["headRoll"],
        "lookingAway": result["lookingAway"],
    }


@router.post("/eye-gaze")
async def eye_gaze(
    payload: dict,
    auth=Depends(verify_auth),
):
    base64_frame = payload.get("image", "")
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(executor, analyze_frame_sync, base64_frame)
    return {
        "eyeDirection": result["eyeDirection"],
        "eyesClosed": result["eyesClosed"],
    }


@router.post("/capture-reference")
async def capture_reference(
    payload: dict,
    auth=Depends(verify_auth),
):
    global reference_captured
    frame = decode_base64_to_frame(payload.get("image", ""))
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid frame")
    frame = compress_frame(frame)

    loop = asyncio.get_event_loop()
    success = await loop.run_in_executor(executor, verification_service.capture_reference, frame)
    reference_captured = success
    return {"success": success}


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        self.active_connections.pop(client_id, None)

    async def send_json(self, client_id: str, data: dict):
        ws = self.active_connections.get(client_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(client_id)


manager = ConnectionManager()


@router.websocket("/ws/proctor")
async def proctor_websocket(websocket: WebSocket, client_id: str = "default"):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            base64_frame = payload.get("image", "")

            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(executor, analyze_frame_sync, base64_frame)

            response = {
                "faceDetected": result["faceDetected"],
                "multipleFaces": result["multipleFaces"],
                "headDirection": result["headDirection"],
                "eyeDirection": result["eyeDirection"],
                "phoneDetected": result["phoneDetected"],
                "identityVerified": verification_service.has_reference(),
                "warnings": result["warnings"],
                "cheatingCount": result["cheatingCount"],
            }
            await websocket.send_json(response)

            await asyncio.sleep(0.033)

    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
        manager.disconnect(client_id)
