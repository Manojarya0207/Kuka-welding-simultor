"""
FastAPI application entry point for KUKA Robot Controller API & WebSocket server.
Standard: DIN EN ISO 10218-1 Industrial Robot Safety & Communication.
"""

from contextlib import asynccontextmanager
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
from database.session import init_db
from robot.state_manager import state_manager
from robot.gateway import robot_gateway
from services.notification_service import notification_service
from services.command_service import command_service
from server.websocket_manager import ws_manager
from server.routes import router

# Industrial Standard Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("KUKA.Server")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for startup and shutdown procedures."""
    logger.info("=" * 64)
    logger.info("  KUKA ROBOT DIGITAL TWIN & CONTROLLER SERVER INITIALIZING")
    logger.info("  Initializing SQLite database & schema...")
    init_db()

    # Wire up broadcasters
    state_manager.register_ws_broadcaster(ws_manager.broadcast)
    notification_service.set_ws_broadcaster(ws_manager.broadcast)
    command_service.set_ws_broadcaster(ws_manager.broadcast)

    # Wire closed-loop feedback cycle evaluator
    state_manager.register_command_evaluator(command_service.evaluate_feedback_cycle)

    # Start continuous high-speed state streaming loop
    await state_manager.start()

    logger.info("  REST API Base:     http://%s:%d/api", FASTAPI_HOST, FASTAPI_PORT)
    logger.info("  WebSocket Stream:  ws://%s:%d/ws/robot", FASTAPI_HOST, FASTAPI_PORT)
    logger.info("  WebSocket Robots:  ws://%s:%d/ws/robots/{robot_id}", FASTAPI_HOST, FASTAPI_PORT)
    logger.info("=" * 64)

    # Emit server started notification
    await notification_service.emit_notification(
        event_type="ROBOT_CONNECTED",
        severity="INFO",
        title="Robot Controller Online",
        message="KUKA KR C5 Controller gateway connected and streaming telemetry.",
        robot_id="KUKA-01",
        force=True
    )

    yield

    logger.info("KUKA Robot Controller Server shutting down...")
    await state_manager.stop()
    await robot_gateway.disconnect()
    logger.info("Shutdown complete.")


app = FastAPI(
    title="KUKA 6-Axis Robot Controller & Digital Twin API",
    description="Industrial FastAPI service providing closed-loop verified telemetry, command state machine, and real-time notification engine.",
    version="1.0.0",
    lifespan=lifespan
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.main:app", host=FASTAPI_HOST, port=FASTAPI_PORT, reload=True)
