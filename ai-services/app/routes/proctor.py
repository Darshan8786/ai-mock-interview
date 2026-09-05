from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import logging
import cv2
import numpy as np
import base64
import json
from app.services.proctoring_engine import ProctoringEngine

router = APIRouter(prefix="/proctor", tags=["proctor"])
logger = logging.getLogger(__name__)
engine = ProctoringEngine()

SAFE_RESULT = {
    "faceCount": 1,
    "faceStatus": "normal",
    "lookingAway": False,
    "lookingDirection": "forward",
    "mobilePhone": False,
    "headset": False,
    "cameraObstructed": False,
    "analysisDegraded": True,
    "violations": [],
}


def _decode_frame(data: str):
    if data.startswith("data:image"):
        data = data.split(",", 1)[1]
    img_bytes = base64.b64decode(data)
    np_arr = np.frombuffer(img_bytes, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)


@router.websocket("/ws/{session_id}")
async def proctor_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()
    logger.info(f"Proctoring WebSocket connected for session {session_id}")
    last_result = dict(SAFE_RESULT)

    # Frame decoding and MediaPipe/YOLO inference are CPU-bound and run for
    # tens-to-hundreds of ms per frame. Running them inline in this coroutine
    # blocks the event loop, which stalls *every other* proctoring socket and,
    # worse, delays the WebSocket handshake of new connections - the client
    # then sits on "Connecting to proctoring..." for many seconds. So:
    #   1. every heavy call is pushed to a worker thread (asyncio.to_thread), and
    #   2. a producer/consumer split keeps only the newest frame - if analysis
    #      falls behind the 2 FPS send rate we skip the backlog instead of
    #      processing ever-staler frames and drifting further behind.
    latest_frame: dict = {"data": None}
    new_frame = asyncio.Event()
    closed = asyncio.Event()

    async def receiver():
        try:
            while True:
                latest_frame["data"] = await websocket.receive_text()
                new_frame.set()
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.warning(f"Proctoring receiver error for {session_id}: {e}")
        finally:
            closed.set()
            new_frame.set()

    recv_task = asyncio.create_task(receiver())
    try:
        while not closed.is_set():
            await new_frame.wait()
            new_frame.clear()
            if closed.is_set():
                break

            data = latest_frame["data"]
            latest_frame["data"] = None
            if data is None:
                continue

            # A single malformed/truncated frame (network blip, partial send)
            # must not end the session - reply with a degraded result and keep
            # going. Only the client actually leaving (closed) breaks the loop.
            try:
                frame = await asyncio.to_thread(_decode_frame, data)
                if frame is None:
                    await websocket.send_text(
                        json.dumps({**last_result, "analysisDegraded": True})
                    )
                    continue

                result = await asyncio.to_thread(engine.process_frame, session_id, frame)
                last_result = result
                await websocket.send_text(json.dumps(result))
            except WebSocketDisconnect:
                break
            except Exception as frame_error:
                logger.warning(
                    f"Frame processing error for {session_id}: {frame_error}"
                )
                try:
                    await websocket.send_text(
                        json.dumps({**last_result, "analysisDegraded": True})
                    )
                except Exception:
                    break
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for {session_id}")
    except Exception as e:
        logger.error(f"Error in proctoring socket for {session_id}: {e}")
    finally:
        recv_task.cancel()
        engine.sessions.pop(session_id, None)
