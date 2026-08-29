"""
HTTP client for communicating with the FastAPI KUKA Robot Controller backend.
"""

import logging
from typing import Any, Dict, Optional, Tuple
import httpx

from config import FASTAPI_URL, API_TIMEOUT
from models import JointState

logger = logging.getLogger("KUKA.APIClient")


class RobotApiClient:
    """Synchronous / Async capable HTTP client for KUKA Robot API."""

    def __init__(self, base_url: str = FASTAPI_URL, timeout: float = API_TIMEOUT):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def check_health(self) -> Tuple[bool, str]:
        """Check if FastAPI server is reachable and healthy."""
        url = f"{self.base_url}/api/health"
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("status") == "ok":
                        return True, "Server healthy"
                return False, f"Unexpected status: {resp.status_code}"
        except httpx.ConnectError:
            return False, "Unable to connect to FastAPI server (Connection refused)"
        except httpx.TimeoutException:
            return False, "Connection timed out"
        except Exception as err:
            return False, f"API Error: {str(err)}"

    def get_joints(self) -> Tuple[bool, Optional[Dict[str, float]], str]:
        """Fetch current joint positions from FastAPI server."""
        url = f"{self.base_url}/api/robot/joints"
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    return True, data, "OK"
                return False, None, f"Failed to get joints: HTTP {resp.status_code}"
        except Exception as err:
            return False, None, f"Connection error: {str(err)}"

    def send_joints(self, joints: Dict[str, float]) -> Tuple[bool, Optional[Dict[str, Any]], str]:
        """
        Send new 6-axis joint positions to FastAPI backend.
        FastAPI validates and broadcasts to WebSocket clients (React 3D simulator).
        """
        url = f"{self.base_url}/api/robot/joints"
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(url, json=joints)
                if resp.status_code == 200:
                    data = resp.json()
                    logger.info("Sent joint update: %s -> Response: %s", joints, data)
                    return True, data, "Success"
                elif resp.status_code == 422:
                    error_detail = resp.json().get("detail", "Validation error")
                    logger.warning("Validation error sending joints: %s", error_detail)
                    return False, None, f"Validation Error: {error_detail}"
                else:
                    return False, None, f"HTTP Error {resp.status_code}: {resp.text}"
        except httpx.ConnectError:
            msg = "FastAPI server unavailable (is server running on port 8000?)"
            logger.error(msg)
            return False, None, msg
        except httpx.TimeoutException:
            msg = "Request timed out while sending joint data."
            logger.error(msg)
            return False, None, msg
        except Exception as err:
            msg = f"Unexpected error sending joints: {str(err)}"
            logger.error(msg)
            return False, None, msg
