"""Robot gateway, state manager, and completion detector."""
from robot.gateway import robot_gateway
from robot.state_manager import state_manager
from robot.completion_detector import completion_detector

__all__ = ["robot_gateway", "state_manager", "completion_detector"]
