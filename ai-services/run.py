#!/usr/bin/env python3
import os
import uvicorn
from app.config import settings

if __name__ == "__main__":
    # Auto-reload is OFF by default: every code save otherwise reboots the
    # worker, which re-downloads/re-warms the ML models and kills any live
    # proctoring socket mid-interview. Opt in with PROCTOR_RELOAD=true while
    # actively editing this service.
    reload = os.getenv("PROCTOR_RELOAD", "false").lower() == "true"
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=reload,
        log_level="info",
    )
