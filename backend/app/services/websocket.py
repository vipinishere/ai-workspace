"""
WebSocket connection manager for real-time analytics updates.
"""

from __future__ import annotations

import logging
import uuid
from typing import Dict, List
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections by user_id."""

    def __init__(self) -> None:
        self.active_connections: Dict[uuid.UUID, List[WebSocket]] = {}

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info("WebSocket connected for user %s. Active connections: %d", user_id, len(self.active_connections[user_id]))

    def disconnect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info("WebSocket disconnected for user %s", user_id)

    async def broadcast_to_user(self, user_id: uuid.UUID, message: dict) -> None:
        if user_id not in self.active_connections:
            return

        import json
        payload = json.dumps(message)

        disconnected_sockets = []
        for connection in self.active_connections[user_id]:
            try:
                await connection.send_text(payload)
            except Exception as exc:
                logger.warning("Error sending WebSocket message to user %s: %s", user_id, exc)
                disconnected_sockets.append(connection)

        # Clean up any failed connections
        for dead_socket in disconnected_sockets:
            self.disconnect(user_id, dead_socket)


# Module-level singleton
ws_manager = ConnectionManager()
