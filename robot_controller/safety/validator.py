"""
Command pre-flight validation service.
Implements PRD Section 10 pre-flight validation rules.
"""

from typing import Dict, Tuple, Any
from safety.limits import is_joint_within_limits
from safety.interlock import safety_interlock


class CommandValidator:
    """Validates joint commands against physical constraints, safety interlocks, and state."""

    @staticmethod
    def validate_command(joints: Dict[str, float], robot_status: str, mode: str) -> Tuple[bool, str]:
        """
        Perform all PRD Section 10 pre-flight checks:
        1. Joint angles within physical limits
        2. Robot is in live/ready state
        3. No active error/fault condition
        4. Safety interlocks satisfied
        5. Valid joint specification
        """
        # 1. Check safety interlock
        safe, reason = safety_interlock.check_safe_to_move()
        if not safe:
            return False, reason

        # 2. Check robot connection status
        if robot_status.lower() != "connected":
            return False, f"Robot is currently {robot_status}. Cannot dispatch live movement."

        # 3. Check joint values
        if not joints:
            return False, "No joint angles provided."

        for axis in ["a1", "a2", "a3", "a4", "a5", "a6"]:
            if axis in joints:
                val = float(joints[axis])
                ok, err = is_joint_within_limits(axis, val)
                if not ok:
                    return False, err

        return True, ""


validator = CommandValidator()
