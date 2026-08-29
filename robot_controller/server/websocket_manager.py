"""
WebSocket Connection Manager for KUKA Robot Controller.
Implements PRD Sections 20, 21.
Broadcasting unified events:
- robot_state
- notification
- command_update
"""

import json
import logging
from typing import Any, Dict, List, Set
from fastapi import WebSocket

logger = logging.getLogger("KUKA.WebSocketManager")


class WebSocketManager:
    """Manages active WebSocket connections to 3D simulators and client web dashboards."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.channel_subscribers: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel: str = "default") -> None:
        """Accept incoming client WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        if channel not in self.channel_subscribers:
            self.channel_subscribers[channel] = set()
        self.channel_subscribers[channel].add(websocket)

        client_info = f"{websocket.client.host}:{websocket.client.port}" if websocket.client else "unknown"
        logger.info(
            "WebSocket client connected: %s on channel '%s' (Total active: %d)",
            client_info, channel, len(self.active_connections)
        )

    def disconnect(self, websocket: WebSocket) -> None:
        """Unregister disconnected client."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

        for ch, subs in self.channel_subscribers.items():
            subs.discard(websocket)

        client_info = f"{websocket.client.host}:{websocket.client.port}" if websocket.client else "unknown"
        logger.info("WebSocket client disconnected: %s (Remaining: %d)", client_info, len(self.active_connections))

    async def broadcast(self, message: Dict[str, Any], channel: str = None) -> None:
        """
        Broadcast JSON telemetry or notification message.
        Prunes dead connections automatically.
        """
        targets = list(self.active_connections) if not channel else list(self.channel_subscribers.get(channel, []))
        if not targets:
            return

        payload = json.dumps(message)
        dead_connections: List[WebSocket] = []

        for conn in targets:
            try:
                await conn.send_text(payload)
            except Exception:
                dead_connections.append(conn)

        for dead in dead_connections:
            self.disconnect(dead)


# Global WebSocket Manager singleton
ws_manager = WebSocketManager()
