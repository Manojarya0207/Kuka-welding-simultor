"""
Configuration module for KUKA Robot Controller & Simulator Interface.
Standard: DIN EN ISO 10218-1 / KUKA KR CYBERTECH Specification.
"""

from typing import Dict, Tuple

# FastAPI Server Networking
FASTAPI_HOST: str = "127.0.0.1"
FASTAPI_PORT: int = 8000
FASTAPI_URL: str = f"http://{FASTAPI_HOST}:{FASTAPI_PORT}"
WEBSOCKET_PATH: str = "/ws/robot"
WEBSOCKET_URL: str = f"ws://{FASTAPI_HOST}:{FASTAPI_PORT}{WEBSOCKET_PATH}"
SIMULATOR_URL: str = "http://localhost:5173"

# Industrial Joint Limits (Degrees: Min, Max)
# Configured for KUKA 6-axis articulated arm kinematics
JOINT_LIMITS: Dict[str, Tuple[float, float]] = {
    "a1": (-185.0, 185.0),
    "a2": (-155.0, 35.0),
    "a3": (-130.0, 154.0),
    "a4": (-350.0, 350.0),
    "a5": (-130.0, 130.0),
    "a6": (-350.0, 350.0),
}

# Calibrated Default / Home Angles (Degrees)
DEFAULT_JOINTS: Dict[str, float] = {
    "a1": 0.0,
    "a2": -30.6,
    "a3": 29.4,
    "a4": 0.0,
    "a5": 43.8,
    "a6": -112.5,
}

# Animation and Stream Configurations
MOVEMENT_SPEED: float = 50.0       # Standard interpolation speed (percentage)
STREAM_INTERVAL: float = 0.2       # Seconds between simulated streaming packets (200ms)
API_TIMEOUT: float = 3.0           # HTTP request timeout in seconds
RECONNECT_INTERVAL: float = 2.0    # WebSocket reconnection delay in seconds
