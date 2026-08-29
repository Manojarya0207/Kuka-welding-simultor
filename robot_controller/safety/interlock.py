"""
Safety interlocks state and hardware check relays.
"""

from typing import Tuple


class SafetyInterlock:
    """Manages safety gate, E-stop, and drive power interlocks."""

    def __init__(self):
        self.estop_active: bool = False
        self.safety_gate_closed: bool = True
        self.drives_powered: bool = True

    def trigger_estop(self):
        self.estop_active = True
        self.drives_powered = False

    def reset_estop(self):
        self.estop_active = False
        self.drives_powered = True

    def check_safe_to_move(self) -> Tuple[bool, str]:
        if self.estop_active:
            return False, "Emergency Stop is active. Reset E-stop circuit before commanding motion."
        if not self.safety_gate_closed:
            return False, "Safety gate barrier open. Motion prohibited."
        if not self.drives_powered:
            return False, "Main 400V motor drives are de-energized."
        return True, ""


# Singleton instance
safety_interlock = SafetyInterlock()
