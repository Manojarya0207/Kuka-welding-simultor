"""
FastAPI REST Endpoints and WebSocket Handlers for KUKA Industrial Robot.
Implements PRD Section 51 API Specifications.
"""

from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field

from robot.gateway import robot_gateway
from robot.state_manager import state_manager
from services.command_service import command_service
from services.notification_service import notification_service
from services.audit_service import audit_service
from server.websocket_manager import ws_manager
from database.session import SessionLocal
from database.models import Robot, AuditLog

logger = logging.getLogger("KUKA.Routes")

router = APIRouter()


# -----------------------------------------------------------------------------
# Pydantic Request & Response Schemas
# -----------------------------------------------------------------------------
class JointCommandRequest(BaseModel):
    command_type: str = "MOVE_JOINT"
    joints: Dict[str, float]
    preview: bool = False
    mode: Optional[str] = "LIVE"
    speed: Optional[float] = 50.0


class ModeChangeRequest(BaseModel):
    mode: str  # "LIVE" or "SIMULATION"


# -----------------------------------------------------------------------------
# REST Endpoints
# -----------------------------------------------------------------------------
@router.get("/api/health")
async def get_health() -> Dict[str, str]:
    """Health check endpoint (PRD Section 51)."""
    return {"status": "ok", "version": "1.0.0"}


@router.get("/api/robot/joints")
async def get_robot_joints() -> Dict[str, float]:
    """Desktop GUI endpoint: fetch current 6-axis joint angles."""
    gw_state = await robot_gateway.get_state()
    return gw_state["joints"]


@router.post("/api/robot/joints")
async def set_robot_joints(joints: Dict[str, Any]) -> Dict[str, Any]:
    """
    Desktop GUI endpoint: submit 6-axis robot joint angles.
    Dispatches closed-loop motion, updates gateway, and broadcasts to WebSocket clients.
    """
    clean_joints = {
        f"a{i}": float(joints.get(f"a{i}", joints.get(f"A{i}", 0.0)))
        for i in range(1, 7)
    }

    res = await command_service.submit_command(
        robot_id="KUKA-01",
        joints=clean_joints,
        command_type="MOVE_JOINT",
        mode="LIVE",
        speed_pct=60.0
    )

    now_iso = datetime.now(timezone.utc).isoformat()
    await ws_manager.broadcast({
        "type": "joint_update",
        "timestamp": now_iso,
        "joints": clean_joints
    })

    return {
        "success": True,
        "joints": clean_joints,
        "command_id": res.get("command_id")
    }


@router.get("/api/robots")
async def get_robots() -> Dict[str, List[Dict[str, Any]]]:
    """List available robots (PRD Section 51)."""
    with SessionLocal() as db:
        robots = db.query(Robot).all()
        robot_list = []
        for r in robots:
            gw_state = await robot_gateway.get_state()
            robot_list.append({
                "id": r.id,
                "name": r.name,
                "model": r.model,
                "status": "connected" if gw_state["connected"] else "disconnected",
                "mode": gw_state["mode"],
                "ip_address": r.ip_address,
                "port": r.port,
            })
        return {"robots": robot_list}


@router.get("/api/robots/{robot_id}/state")
async def get_robot_state(robot_id: str) -> Dict[str, Any]:
    """Read authoritative robot state and current joint angles (PRD Section 51)."""
    state = await robot_gateway.get_state()
    return {
        "robot_id": robot_id,
        "status": state["status"].lower(),
        "motion_state": state["motion_state"],
        "mode": state["mode"],
        "drives_energized": state["drives_energized"],
        "joints": state["joints"],
    }


@router.post("/api/robots/{robot_id}/commands")
async def send_command(robot_id: str, req: JointCommandRequest) -> Dict[str, Any]:
    """
    Submit joint motion command to robot (PRD Section 9, 51).
    Validates, queues, sends to gateway, and monitors actual feedback.
    """
    gw_state = await robot_gateway.get_state()
    active_mode = req.mode or gw_state["mode"]

    res = await command_service.submit_command(
        robot_id=robot_id,
        joints=req.joints,
        command_type=req.command_type,
        mode=active_mode,
        speed_pct=req.speed or 50.0
    )

    if not res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res
        )

    return res


@router.get("/api/commands/{command_id}")
async def get_command_status(command_id: str) -> Dict[str, Any]:
    """Get lifecycle status and actual results for a command (PRD Section 51)."""
    cmd = command_service.get_command(command_id)
    if not cmd:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Command not found")
    return cmd


@router.get("/api/robots/{robot_id}/commands")
async def get_command_history(
    robot_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
) -> Dict[str, Any]:
    """Retrieve command history table (PRD Section 38, 51)."""
    history = command_service.get_command_history(robot_id=robot_id, limit=limit, offset=offset)
    return {
        "robot_id": robot_id,
        "commands": history,
        "count": len(history)
    }


@router.post("/api/robots/{robot_id}/stop")
async def stop_robot(robot_id: str) -> Dict[str, Any]:
    """Emergency halt robot motion immediately (PRD Section 45, 51)."""
    await command_service.emergency_stop(robot_id)
    return {"success": True, "message": "Emergency Stop Engaged. Robot halted."}


@router.post("/api/robots/{robot_id}/reset")
async def reset_robot(robot_id: str) -> Dict[str, Any]:
    """Reset safety interlock and re-energize 400V motor drives."""
    await robot_gateway.reset()
    await notification_service.emit_notification(
        event_type="SAFETY_STATE_CHANGED",
        severity="INFO",
        title="Safety Circuit Reset",
        message="Robot main drives re-energized. System ready for motion.",
        robot_id=robot_id,
        force=True
    )
    return {"success": True, "message": "Safety reset complete. Drives energized."}


@router.post("/api/robots/{robot_id}/mode")
async def set_robot_mode(robot_id: str, req: ModeChangeRequest) -> Dict[str, Any]:
    """Toggle LIVE vs SIMULATION mode (PRD Section 46, 47)."""
    new_mode = robot_gateway.set_mode(req.mode)
    with SessionLocal() as db:
        rob = db.query(Robot).filter(Robot.id == robot_id).first()
        if rob:
            rob.mode = new_mode
            db.commit()

    await notification_service.emit_notification(
        event_type="SAFETY_STATE_CHANGED",
        severity="INFO",
        title="Control Mode Changed",
        message=f"Robot control mode switched to {new_mode}.",
        robot_id=robot_id,
        force=True
    )
    audit_service.log_action("mode_changed", "robot", robot_id, {"mode": new_mode})
    return {"success": True, "mode": new_mode}


@router.get("/api/notifications")
async def get_notifications(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    unread: bool = Query(False),
    severity: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """Retrieve system notifications (PRD Section 12, 31, 51)."""
    notifs = notification_service.get_notifications(
        limit=limit, offset=offset, unread_only=unread, severity=severity
    )
    unread_count = notification_service.get_unread_count()
    return {
        "notifications": notifs,
        "unread_count": unread_count,
        "count": len(notifs),
    }


@router.post("/api/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str) -> Dict[str, Any]:
    """Mark a notification as read (PRD Section 32, 51)."""
    success = notification_service.mark_as_read(notification_id)
    return {"success": success}


@router.post("/api/notifications/read-all")
async def mark_all_notifications_read() -> Dict[str, Any]:
    """Mark all notifications as read."""
    count = notification_service.mark_all_as_read()
    return {"success": True, "marked_count": count}


@router.get("/api/audit-logs")
async def get_audit_logs(limit: int = Query(50, ge=1, le=200)) -> Dict[str, Any]:
    """Retrieve system audit trail logs (PRD Section 43)."""
    with SessionLocal() as db:
        logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
        return {"logs": [l.to_dict() for l in logs]}


# -----------------------------------------------------------------------------
# Unified WebSocket Endpoints (PRD Section 20, 21, 51)
# -----------------------------------------------------------------------------
@router.websocket("/ws/robots/{robot_id}")
@router.websocket("/ws/robot")
async def websocket_robot_endpoint(websocket: WebSocket, robot_id: str = "KUKA-01"):
    """
    Unified WebSocket telemetry, notification, and command stream.
    Broadcasts:
    1. robot_state (authoritative actual joint feedback)
    2. notification (verified closed-loop completion, events)
    3. command_update (state machine progress)
    """
    channel = f"robot:{robot_id}"
    await ws_manager.connect(websocket, channel=channel)

    # Send initial snapshot immediately upon connection
    gw_state = await robot_gateway.get_state()
    initial_event = {
        "event_id": "EVT-INIT-000001",
        "type": "robot_state",
        "robot_id": robot_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "payload": {
            "status": gw_state["status"],
            "motion_state": gw_state["motion_state"],
            "mode": gw_state["mode"],
            "drives_energized": gw_state["drives_energized"],
            "actual_joints": gw_state["joints"],
        }
    }
    await websocket.send_text(json.dumps(initial_event))

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                action = msg.get("action")
                if action == "ping":
                    await websocket.send_text(json.dumps({"type": "pong", "timestamp": datetime.now(timezone.utc).isoformat()}))
                elif action == "subscribe":
                    logger.debug("Client subscription confirmed: %s", msg)
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as err:
        logger.warning("WebSocket disconnect on channel %s: %s", channel, err)
        ws_manager.disconnect(websocket)
