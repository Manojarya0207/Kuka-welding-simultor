"""
FastAPI route definitions and WebSocket handlers for KUKA robot joint communication.
"""

from datetime import datetime, timezone
import logging
import sys
from typing import Any, Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

# Ensure parent directory is in python path for imports when run via uvicorn
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import DEFAULT_JOINTS
from models import JointState, JointResponse, HealthResponse, WebSocketMessage
from server.websocket_manager import ws_manager

logger = logging.getLogger("KUKA.Routes")

router = APIRouter()

# In-memory storage for current robot joint state
current_joints = JointState(**DEFAULT_JOINTS)


@router.get("/api/health", response_model=HealthResponse)
async def get_health() -> Dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@router.get("/api/robot/joints", response_model=Dict[str, float])
async def get_robot_joints() -> Dict[str, float]:
    """Get the current 6-axis robot joint angles."""
    return current_joints.to_dict()


@router.post("/api/robot/joints", response_model=JointResponse)
async def set_robot_joints(joints: JointState) -> Dict[str, Any]:
    """
    Set 6-axis robot joint angles.
    Validates input limits, stores state, and broadcasts via WebSocket.
    """
    global current_joints
    current_joints = joints

    # Formulate WebSocket broadcast message
    ws_payload = {
        "type": "joint_update",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "joints": current_joints.to_dict()
    }

    logger.info(
        "[ROBOT-SET] A1:%.1f° A2:%.1f° A3:%.1f° A4:%.1f° A5:%.1f° A6:%.1f° -> Broadcasting",
        joints.a1, joints.a2, joints.a3, joints.a4, joints.a5, joints.a6
    )

    # Broadcast to all connected 3D simulators asynchronously
    await ws_manager.broadcast(ws_payload)

    return {
        "success": True,
        "joints": current_joints.to_dict()
    }


@router.websocket("/ws/robot")
async def websocket_robot_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time 3D simulator connection.
    Broadcasts joint position updates as they occur.
    """
    await ws_manager.connect(websocket)

    # Send initial state immediately so client synchronizes upon connection
    initial_payload = {
        "type": "joint_update",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "joints": current_joints.to_dict()
    }
    await ws_manager.send_personal_message(initial_payload, websocket)

    try:
        while True:
            # Keep socket open and process any incoming ping/pong or client commands
            data = await websocket.receive_text()
            logger.debug("Received from simulator client: %s", data)
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as err:
        logger.warning("WebSocket connection exception: %s", err)
        ws_manager.disconnect(websocket)
