from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "MindPrep AI Proctoring Service",
        "version": "2.0.0",
    }
