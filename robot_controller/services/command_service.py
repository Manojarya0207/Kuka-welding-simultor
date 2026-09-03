"""
Command Lifecycle and Execution Service.
Implements PRD Sections 8, 9, 10, 25, 26, 27, 28, 35, 40, 41, 62.
Coordinates:
- State machine: RECEIVED -> VALIDATING -> VALIDATED -> QUEUED -> SENT_TO_ROBOT -> MOVING -> TARGET_REACHED -> COMPLETED
- Unique Command ID: CMD-YYYYMMDD-XXXXXX
- Verified closed-loop completion detection from actual robot feedback
- 60-second command timeout detection
"""

import asyncio
from datetime import datetime, timezone
import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

from config import COMMAND_TIMEOUT_SECONDS, JOINT_TOLERANCES
from database.models import RobotCommand, CommandEvent
from database.session import SessionLocal
from robot.gateway import robot_gateway
from robot.completion_detector import completion_detector
from safety.validator import validator
from services.notification_service import notification_service
from services.audit_service import audit_service

logger = logging.getLogger("KUKA.CommandService")


class CommandService:
    """Manages command submission, state machine transitions, feedback verification, and timeouts."""

    def __init__(self):
        self._command_counter: int = 1
        self.active_command: Optional[Dict[str, Any]] = None
        self.active_command_lock = asyncio.Lock()
        self.ws_broadcaster = None

    def set_ws_broadcaster(self, broadcaster):
        self.ws_broadcaster = broadcaster

    def generate_command_id(self) -> str:
        """Generate unique command ID: CMD-YYYYMMDD-XXXXXX"""
        today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        try:
            with SessionLocal() as db:
                count = db.query(RobotCommand).filter(RobotCommand.command_id.like(f"CMD-{today_str}-%")).count()
                return f"CMD-{today_str}-{count + 1:06d}"
        except Exception:
            self._command_counter += 1
            return f"CMD-{today_str}-{self._command_counter:06d}"

    async def _emit_command_event(self, command_id: str, event_type: str, status: str, payload: Optional[Dict[str, Any]] = None):
        """Record command event to database and broadcast command_update over WebSocket."""
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.isoformat()
        pl = payload or {}

        # 1. Update command record in DB
        try:
            with SessionLocal() as db:
                cmd = db.query(RobotCommand).filter(RobotCommand.command_id == command_id).first()
                if cmd:
                    cmd.status = status
                    if status == "MOVING" and not cmd.started_at:
                        cmd.started_at = now_dt
                    elif status in ["COMPLETED", "FAILED", "TIMEOUT", "STOPPED"]:
                        cmd.completed_at = now_dt
                        if "actual_joints" in pl:
                            cmd.actual_joints = json.dumps(pl["actual_joints"])
                        if "error_message" in pl:
                            cmd.error_message = pl["error_message"]

                    # Add event record
                    import uuid
                    evt_id = f"EVT-CMD-{uuid.uuid4().hex[:10].upper()}"
                    evt = CommandEvent(
                        event_id=evt_id,
                        command_id=command_id,
                        robot_id=cmd.robot_id,
                        event_type=event_type,
                        timestamp=now_dt,
                        payload=json.dumps(pl),
                    )
                    db.add(evt)
                    db.commit()
        except Exception as err:
            logger.error("Error updating command DB state: %s", err)

        # 2. Broadcast command_update event over WebSocket
        if self.ws_broadcaster:
            update_msg = {
                "event_id": f"EVT-UP-{uuid.uuid4().hex[:10].upper()}",
                "type": "command_update",
                "command_id": command_id,
                "status": status,
                "event": event_type,
                "timestamp": now_iso,
                "payload": pl,
            }
            try:
                await self.ws_broadcaster(update_msg)
            except Exception as err:
                logger.warning("Error broadcasting command_update: %s", err)

    async def submit_command(
        self,
        robot_id: str,
        joints: Dict[str, float],
        command_type: str = "MOVE_JOINT",
        mode: str = "LIVE",
        speed_pct: float = 50.0
    ) -> Dict[str, Any]:
        """
        Full lifecycle execution of a robot motion command:
        Step 1: COMMAND_RECEIVED
        Step 2: COMMAND_VALIDATED (or REJECTED)
        Step 3: COMMAND_SENT
        Step 4: Monitoring actual feedback stream until TARGET_REACHED -> COMMAND_COMPLETED
        """
        command_id = self.generate_command_id()
        now_dt = datetime.now(timezone.utc)

        # Normalized joints dictionary
        clean_joints = {f"a{i}": float(joints.get(f"a{i}", joints.get(f"A{i}", 0.0))) for i in range(1, 7)}

        # Persist initial command record
        with SessionLocal() as db:
            cmd_rec = RobotCommand(
                command_id=command_id,
                robot_id=robot_id,
                command_type=command_type,
                mode=mode,
                target_joints=json.dumps(clean_joints),
                status="RECEIVED",
                created_at=now_dt,
            )
            db.add(cmd_rec)
            db.commit()

        # Step 1: COMMAND_RECEIVED
        await self._emit_command_event(command_id, "COMMAND_RECEIVED", "RECEIVED", {"target_joints": clean_joints})
        await notification_service.emit_notification(
            event_type="COMMAND_RECEIVED",
            severity="INFO",
            title="Command Received",
            message=f"Command accepted by backend: {', '.join([f'{k.upper()}={v:.1f}deg' for k, v in clean_joints.items()])}",
            robot_id=robot_id,
            command_id=command_id,
            metadata={"target_joints": clean_joints}
        )

        # Step 2: Pre-flight validation
        robot_state = await robot_gateway.get_state()
        is_valid, reason = validator.validate_command(clean_joints, "connected", mode)

        if not is_valid:
            # COMMAND_REJECTED
            await self._emit_command_event(command_id, "COMMAND_REJECTED", "REJECTED", {"reason": reason})
            await notification_service.emit_notification(
                event_type="COMMAND_REJECTED",
                severity="ERROR",
                title="Command Rejected",
                message=f"Validation failed: {reason}",
                robot_id=robot_id,
                command_id=command_id,
                metadata={"reason": reason}
            )
            audit_service.log_action("command_rejected", "command", command_id, {"reason": reason})
            return {
                "success": False,
                "command_id": command_id,
                "status": "REJECTED",
                "message": reason
            }

        # Step 2b: COMMAND_VALIDATED
        await self._emit_command_event(command_id, "COMMAND_VALIDATED", "VALIDATED")
        await notification_service.emit_notification(
            event_type="COMMAND_VALIDATED",
            severity="INFO",
            title="Command Validated",
            message="Pre-flight kinematics and safety checks passed.",
            robot_id=robot_id,
            command_id=command_id
        )

        # Step 3: COMMAND_SENT to KUKA Gateway
        robot_gateway.set_mode(mode)
        await self._emit_command_event(command_id, "COMMAND_SENT", "SENT_TO_ROBOT")
        await notification_service.emit_notification(
            event_type="COMMAND_SENT",
            severity="INFO",
            title="Command Sent",
            message=f"Command transmitted to KUKA controller gateway ({mode} mode).",
            robot_id=robot_id,
            command_id=command_id
        )

        # Register active command for feedback monitoring
        async with self.active_command_lock:
            self.active_command = {
                "command_id": command_id,
                "robot_id": robot_id,
                "target_joints": clean_joints,
                "started_at": time.time(),
                "mode": mode,
                "moving_notified": False,
                "completed": False,
            }

        # Step 4: Dispatch motion trajectory in gateway
        dispatched = await robot_gateway.send_joint_command(clean_joints, speed_pct)
        if not dispatched:
            await self._emit_command_event(command_id, "COMMAND_FAILED", "FAILED", {"reason": "Drives de-energized or gateway error"})
            return {
                "success": False,
                "command_id": command_id,
                "status": "FAILED",
                "message": "Gateway failed to dispatch motion"
            }

        audit_service.log_action("sent_command", "command", command_id, {"target": clean_joints, "mode": mode})

        return {
            "success": True,
            "command_id": command_id,
            "status": "QUEUED",
            "message": "Robot command accepted and executing"
        }

    async def evaluate_feedback_cycle(
        self,
        actual_joints: Dict[str, float],
        robot_status: str,
        motion_state: str
    ):
        """
        Called on every feedback cycle from state_manager.
        Evaluates:
        1. Emitting ROBOT_MOVING on motion start
        2. Closed-loop completion detection (tolerance <= 0.05 deg, state IDLE)
        3. 60-second command execution timeout
        """
        if not self.active_command or self.active_command.get("completed"):
            return

        cmd = self.active_command
        cmd_id = cmd["command_id"]
        robot_id = cmd["robot_id"]
        target = cmd["target_joints"]
        started_at = cmd["started_at"]
        elapsed = time.time() - started_at

        # 1. First time robot begins moving -> ROBOT_MOVING
        if robot_status == "MOVING" and not cmd["moving_notified"]:
            cmd["moving_notified"] = True
            await self._emit_command_event(cmd_id, "ROBOT_MOVING", "MOVING", {"actual_joints": actual_joints})
            await notification_service.emit_notification(
                event_type="ROBOT_MOVING",
                severity="INFO",
                title="Robot Moving",
                message=f"Robot is executing motion trajectory to target.",
                robot_id=robot_id,
                command_id=cmd_id,
                metadata={"actual_joints": actual_joints}
            )

        # 2. Check timeout (PRD Section 27: 60 seconds)
        if elapsed > COMMAND_TIMEOUT_SECONDS:
            cmd["completed"] = True
            await self._emit_command_event(
                cmd_id, "COMMAND_TIMEOUT", "TIMEOUT",
                {"elapsed": elapsed, "target_joints": target, "actual_joints": actual_joints}
            )
            await notification_service.emit_notification(
                event_type="COMMAND_TIMEOUT",
                severity="WARNING",
                title="Robot Movement Timeout",
                message=f"The robot did not reach requested position within {COMMAND_TIMEOUT_SECONDS:.0f} seconds.",
                robot_id=robot_id,
                command_id=cmd_id,
                metadata={"elapsed": round(elapsed, 1), "actual_joints": actual_joints}
            )
            audit_service.log_action("command_timeout", "command", cmd_id, {"elapsed": elapsed})
            self.active_command = None
            return

        # 3. Verified Closed-Loop Completion Check (PRD Section 25, 26, 74)
        is_reached, joint_errors, max_error = completion_detector.check_target_reached(
            target_joints=target,
            actual_joints=actual_joints,
            robot_state=robot_status,
            tolerances=JOINT_TOLERANCES
        )

        if is_reached:
            # Check deduplication: only emit completion once
            if completion_detector.mark_event_processed(cmd_id, "COMMAND_COMPLETED"):
                cmd["completed"] = True
                duration = round(time.time() - started_at, 2)

                # Event: ROBOT_TARGET_REACHED
                await self._emit_command_event(
                    cmd_id, "ROBOT_TARGET_REACHED", "TARGET_REACHED",
                    {"max_error": max_error, "joint_errors": joint_errors}
                )

                # Event: COMMAND_COMPLETED
                completed_payload = {
                    "target_joints": target,
                    "actual_joints": actual_joints,
                    "tolerance": JOINT_TOLERANCES["a1"],
                    "error": round(max_error, 4),
                    "duration": duration,
                }
                await self._emit_command_event(cmd_id, "COMMAND_COMPLETED", "COMPLETED", completed_payload)

                target_summary = ", ".join([f"{k.upper()}={v:.1f}deg" for k, v in target.items()])
                await notification_service.emit_notification(
                    event_type="COMMAND_COMPLETED",
                    severity="SUCCESS",
                    title="Robot Movement Completed",
                    message=f"Robot reached target within tolerance ({max_error:.4f}deg error). Target: {target_summary}",
                    robot_id=robot_id,
                    command_id=cmd_id,
                    metadata=completed_payload
                )

                audit_service.log_action("command_completed", "command", cmd_id, completed_payload)
                self.active_command = None

    async def emergency_stop(self, robot_id: str) -> bool:
        """Trigger immediate emergency stop."""
        await robot_gateway.stop()
        if self.active_command:
            cmd_id = self.active_command["command_id"]
            await self._emit_command_event(cmd_id, "ROBOT_STOPPED", "STOPPED", {"reason": "Emergency Stop Triggered"})
            self.active_command = None

        await notification_service.emit_notification(
            event_type="ROBOT_STOPPED",
            severity="WARNING",
            title="Emergency Stop Activated",
            message="Robot halted immediately. Drives de-energized and brakes clamped.",
            robot_id=robot_id,
            force=True
        )
        audit_service.log_action("emergency_stop", "robot", robot_id)
        return True

    def get_command(self, command_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve single command details."""
        with SessionLocal() as db:
            cmd = db.query(RobotCommand).filter(RobotCommand.command_id == command_id).first()
            return cmd.to_dict() if cmd else None

    def get_command_history(self, robot_id: str, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """Retrieve command history list for table display."""
        with SessionLocal() as db:
            cmds = (
                db.query(RobotCommand)
                .filter(RobotCommand.robot_id == robot_id)
                .order_by(RobotCommand.created_at.desc())
                .offset(offset)
                .limit(limit)
                .all()
            )
            return [c.to_dict() for c in cmds]


command_service = CommandService()
