import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import health, proctor
from app.models.downloader import download_all_models

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting MindPrep AI Services...")
    download_all_models()
    # Warm the proctoring models in the background — the first frame's inference
    # won't be a multi-second cold start, but we don't hold up accepting the
    # WebSocket handshake waiting for it either.
    warmup_task = asyncio.create_task(asyncio.to_thread(proctor.engine.warmup))
    logger.info(f"Service ready on port {settings.PORT}")
    yield
    warmup_task.cancel()
    logger.info("Shutting down service...")


app = FastAPI(
    title="MindPrep AI Services",
    description="MindPrep AI Backend Services",
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
