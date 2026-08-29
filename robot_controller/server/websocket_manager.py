"""
WebSocket connection manager for broadcasting KUKA robot joint telemetry.
Supports multiple simultaneous clients and resilient disconnection handling.
"""

import json
import logging
from typing import Any, Dict, List
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger("KUKA.WebSocketManager")


class WebSocketManager:
    """Manages active WebSocket connections to 3D simulators and clients."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Accept new client connection and register in pool."""
        await websocket.accept()
        self.active_connections.append(websocket)
        client_info = f"{websocket.client.host}:{websocket.client.port}" if websocket.client else "unknown"
        logger.info(
            "WebSocket client connected: %s (Total active: %d)",
            client_info,
            len(self.active_connections)
        )

    def disconnect(self, websocket: WebSocket) -> None:
        """Unregister client connection safely."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            client_info = f"{websocket.client.host}:{websocket.client.port}" if websocket.client else "unknown"
            logger.info(
                "WebSocket client disconnected: %s (Remaining active: %d)",
                client_info,
                len(self.active_connections)
            )

    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket) -> None:
        """Send JSON message to a specific connection."""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as err:
            logger.warning("Failed to send message to client: %s", err)
            self.disconnect(websocket)

    async def broadcast(self, message: Dict[str, Any]) -> None:
        """
        Broadcast JSON telemetry message to all connected clients.
        Automatically prunes disconnected clients.
        """
        if not self.active_connections:
            return

        payload = json.dumps(message)
        dead_connections: List[WebSocket] = []

        for connection in list(self.active_connections):
            try:
                await connection.send_text(payload)
            except Exception as err:
                logger.warning("Error broadcasting to client, removing: %s", err)
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)


# Global singleton instance
ws_manager = WebSocketManager()
