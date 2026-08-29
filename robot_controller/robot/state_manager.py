"""
Robot State Manager.
Maintains continuous state tracking, runs feedback streaming loop (30ms),
and triggers closed-loop completion checks.
"""

import asyncio
from datetime import datetime, timezone
import logging
from typing import Any, Dict, Optional

from config import STREAM_INTERVAL
from robot.gateway import robot_gateway
from database.models import RobotStateRecord
from database.session import SessionLocal

logger = logging.getLogger("KUKA.StateManager")


class RobotStateManager:
    """Manages real-time robot kinematics telemetry and periodic broadcasting."""

    def __init__(self):
        self.stream_task: Optional[asyncio.Task] = None
        self.is_running: bool = False
        self._last_persisted_status: str = ""
        self._active_command_callback = None
        self.ws_broadcast_callback = None

    def register_command_evaluator(self, callback):
        """Register callback from CommandService to evaluate active command completion."""
        self._active_command_callback = callback

    def register_ws_broadcaster(self, callback):
        """Register callback from WebSocketManager to broadcast real-time state."""
        self.ws_broadcast_callback = callback

    async def start(self):
        """Start high-frequency state polling and streaming loop."""
        if self.is_running:
            return
        self.is_running = True
        await robot_gateway.connect()
        self.stream_task = asyncio.create_task(self._state_loop())
        logger.info("Robot State Manager streaming loop started (interval: %.3fs)", STREAM_INTERVAL)

    async def stop(self):
        """Stop telemetry loop."""
        self.is_running = False
        if self.stream_task and not self.stream_task.done():
            self.stream_task.cancel()
        logger.info("Robot State Manager loop stopped.")

    async def _state_loop(self):
        """Streaming loop (30ms) broadcasting telemetry and testing target completion."""
        loop_counter = 0
        while self.is_running:
            try:
                state = await robot_gateway.get_state()
                now_iso = datetime.now(timezone.utc).isoformat()

                # Broadcast robot_state event to connected clients & 3D digital twin
                if self.ws_broadcast_callback:
                    state_event = {
                        "event_id": f"EVT-STATE-{loop_counter % 1000000:06d}",
                        "type": "robot_state",
                        "robot_id": "KUKA-01",
                        "timestamp": now_iso,
                        "payload": {
                            "status": state["status"],
                            "motion_state": state["motion_state"],
                            "mode": state["mode"],
                            "drives_energized": state["drives_energized"],
                            "actual_joints": state["joints"],
                        }
                    }
                    await self.ws_broadcast_callback(state_event)

                # Evaluate active command completion via verified feedback
                if self._active_command_callback:
                    await self._active_command_callback(state["joints"], state["status"], state["motion_state"])

                # Selective edge persistence: save state record on status transition or every 5 seconds
                loop_counter += 1
                if state["status"] != self._last_persisted_status or (loop_counter % 150 == 0):
                    self._last_persisted_status = state["status"]
                    self._persist_state_edge(state, now_iso)

                await asyncio.sleep(STREAM_INTERVAL)
            except asyncio.CancelledError:
                break
            except Exception as err:
                logger.warning("Error in state telemetry loop: %s", err)
                await asyncio.sleep(STREAM_INTERVAL)

    def _persist_state_edge(self, state: Dict[str, Any], timestamp_iso: str):
        """Persist state record to database without flooding."""
        try:
            with SessionLocal() as db:
                rec = RobotStateRecord(
                    robot_id="KUKA-01",
                    status=state["status"],
                    motion_state=state["motion_state"],
                    a1=state["joints"]["a1"],
                    a2=state["joints"]["a2"],
                    a3=state["joints"]["a3"],
                    a4=state["joints"]["a4"],
                    a5=state["joints"]["a5"],
                    a6=state["joints"]["a6"],
                )
                db.add(rec)
                db.commit()
        except Exception as err:
            logger.debug("State persistence skipped: %s", err)


# Global singleton
state_manager = RobotStateManager()
