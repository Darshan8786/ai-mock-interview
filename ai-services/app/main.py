import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import proctor, health
from app.models.downloader import download_all_models

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting MindPrep AI Proctoring Service...")
    download_all_models()
    logger.info(f"Service ready on port {settings.PORT}")
    yield
    logger.info("Shutting down proctoring service...")
    proctor.face_service.release()


app = FastAPI(
    title="MindPrep AI Proctoring Service",
    description="Real-time interview proctoring with face detection, YOLO, and face verification",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(proctor.router)
