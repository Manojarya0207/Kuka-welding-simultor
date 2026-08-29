"""
Completion Detector Service.
Implements PRD Sections 4, 25, 26, 74.
Verified closed-loop completion criteria:
- All joint axes within ±0.05° tolerance
- Robot state confirms IDLE / MOTION_COMPLETE / READY
- Event deduplication ({command_id}_{event_type})
"""

import logging
from typing import Dict, Optional, Set, Tuple
from config import JOINT_TOLERANCES, DEFAULT_JOINT_TOLERANCE_DEG

logger = logging.getLogger("KUKA.CompletionDetector")


class CompletionDetector:
    """
    Monitors for verified command completion based on:
    - Commanded target joint angles
    - Authoritative actual robot feedback stream
    - Motion state reported by robot
    - Configured per-joint tolerances
    """

    def __init__(self, default_tolerances: Optional[Dict[str, float]] = None):
        self.tolerances: Dict[str, float] = default_tolerances or JOINT_TOLERANCES.copy()
        # Deduplication cache: set of (command_id, event_type)
        self.processed_events: Set[str] = set()

    def is_event_processed(self, command_id: str, event_type: str) -> bool:
        """Check if an event for this command has already been generated."""
        key = f"{command_id}:{event_type}"
        return key in self.processed_events

    def mark_event_processed(self, command_id: str, event_type: str) -> bool:
        """
        Attempt to register an event.
        Returns True if this is the first time (not processed yet),
        Returns False if already seen (duplicate -> drop).
        """
        key = f"{command_id}:{event_type}"
        if key in self.processed_events:
            return False
        self.processed_events.add(key)
        return True

    def check_target_reached(
        self,
        target_joints: Dict[str, float],
        actual_joints: Dict[str, float],
        robot_state: str,
        tolerances: Optional[Dict[str, float]] = None
    ) -> Tuple[bool, Dict[str, float], float]:
        """
        Verify if all target joints are satisfied within tolerance and robot is idle.
        Returns:
            (reached: bool, errors: Dict[str, float], max_error: float)
        """
        active_tolerances = tolerances or self.tolerances
        errors: Dict[str, float] = {}
        max_error: float = 0.0

        for joint_key in ["a1", "a2", "a3", "a4", "a5", "a6"]:
            # If target specifies this joint, test against actual feedback
            target_val = target_joints.get(joint_key.lower()) or target_joints.get(joint_key.upper())
            if target_val is None:
                continue

            actual_val = actual_joints.get(joint_key.lower()) or actual_joints.get(joint_key.upper())
            if actual_val is None:
                # Missing actual feedback for commanded axis
                return False, errors, 999.0

            err = abs(float(target_val) - float(actual_val))
            errors[joint_key] = round(err, 4)
            if err > max_error:
                max_error = err

            tol = active_tolerances.get(joint_key.lower(), DEFAULT_JOINT_TOLERANCE_DEG)
            if err > tol:
                # Joint has not yet reached target within tolerance
                return False, errors, max_error

        # Motion state check: robot must report idle/ready, not actively moving
        norm_state = str(robot_state).upper()
        if norm_state not in ["IDLE", "MOTION_COMPLETE", "READY"]:
            return False, errors, max_error

        return True, errors, max_error


# Singleton instance
completion_detector = CompletionDetector()
