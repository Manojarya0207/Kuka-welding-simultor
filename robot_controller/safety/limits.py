"""
Joint limits and kinematics bounds for KUKA 6-axis robot.
"""

from typing import Dict, Tuple
from config import JOINT_LIMITS


def get_joint_limits() -> Dict[str, Tuple[float, float]]:
    """Return dictionary of (min, max) degrees for all 6 axes."""
    return JOINT_LIMITS.copy()


def is_joint_within_limits(axis: str, value: float) -> Tuple[bool, str]:
    """
    Check if a specific axis value is within hardware limits.
    Returns: (is_valid, reason_if_invalid)
    """
    ax = axis.lower()
    if ax not in JOINT_LIMITS:
        return False, f"Unknown joint axis '{axis}'"

    min_lim, max_lim = JOINT_LIMITS[ax]
    if not (min_lim <= value <= max_lim):
        return False, f"Joint {axis.upper()} value {value:.2f} deg is outside limits [{min_lim} deg, {max_lim} deg]"

    return True, ""
