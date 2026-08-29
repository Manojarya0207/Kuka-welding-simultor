"""
FastAPI application entry point for KUKA Robot Controller API & WebSocket server.
Standard: DIN EN ISO 10218-1 Industrial Robot Safety & Communication.
"""

import logging
import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure root robot_controller directory is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from config import FASTAPI_HOST, FASTAPI_PORT
from server.routes import router

# Industrial Standard Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("KUKA.Server")

app = FastAPI(
    title="KUKA 6-Axis Robot Controller API",
    description="Industrial FastAPI service providing REST endpoints and WebSocket telemetry broadcast for 3D simulation.",
    version="1.0.0"
)

# Enable CORS for React Simulator & Web Tools
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
async def on_startup():
    logger.info("=" * 64)
    logger.info("  KUKA ROBOT CONTROLLER - FASTAPI SERVER INITIALIZED")
    logger.info("  REST API Base:     http://%s:%d/api", FASTAPI_HOST, FASTAPI_PORT)
    logger.info("  WebSocket Stream:  ws://%s:%d/ws/robot", FASTAPI_HOST, FASTAPI_PORT)
    logger.info("=" * 64)


@app.on_event("shutdown")
async def on_shutdown():
    logger.info("KUKA Robot Controller Server shutting down.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.main:app", host=FASTAPI_HOST, port=FASTAPI_PORT, reload=True)
