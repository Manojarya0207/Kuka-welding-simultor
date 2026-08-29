"""
Data models and Pydantic schemas for KUKA Robot Controller.
"""

from datetime import datetime, timezone
from typing import Dict, Optional
from pydantic import BaseModel, Field, field_validator

from config import JOINT_LIMITS, DEFAULT_JOINTS


class JointState(BaseModel):
    """6-Axis joint angles in degrees."""
    a1: float = Field(default=DEFAULT_JOINTS["a1"], description="Axis 1: Base turntable rotation (degrees)")
    a2: float = Field(default=DEFAULT_JOINTS["a2"], description="Axis 2: Shoulder pitch (degrees)")
    a3: float = Field(default=DEFAULT_JOINTS["a3"], description="Axis 3: Elbow pitch (degrees)")
    a4: float = Field(default=DEFAULT_JOINTS["a4"], description="Axis 4: Forearm roll (degrees)")
    a5: float = Field(default=DEFAULT_JOINTS["a5"], description="Axis 5: Wrist pitch (degrees)")
    a6: float = Field(default=DEFAULT_JOINTS["a6"], description="Axis 6: Tool flange roll (degrees)")

    @field_validator("a1", "a2", "a3", "a4", "a5", "a6", mode="before")
    @classmethod
    def round_and_validate(cls, value: float, info) -> float:
        try:
            val = float(value)
        except (ValueError, TypeError):
            raise ValueError(f"Axis value must be a valid float number, got {value}")

        axis = info.field_name
        if axis in JOINT_LIMITS:
            min_lim, max_lim = JOINT_LIMITS[axis]
            if not (min_lim <= val <= max_lim):
                raise ValueError(
                    f"Axis {axis.upper()} value {val:.1f}° is outside allowed limits [{min_lim}°, {max_lim}°]"
                )
        return round(val, 2)

    def to_dict(self) -> Dict[str, float]:
        return {
            "a1": self.a1,
            "a2": self.a2,
            "a3": self.a3,
            "a4": self.a4,
            "a5": self.a5,
            "a6": self.a6,
        }


class JointResponse(BaseModel):
    """API response model for POST /api/robot/joints."""
    success: bool = True
    joints: JointState


class HealthResponse(BaseModel):
    """API response model for GET /api/health."""
    status: str = "ok"


class WebSocketMessage(BaseModel):
    """WebSocket broadcast message sent to connected 3D simulators."""
    type: str = "joint_update"
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    joints: JointState
