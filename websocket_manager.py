from fastapi import WebSocket
from typing import List
import logging

logger = logging.getLogger("WebSocketManager")

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        subprotocol = None
        protocols = websocket.headers.get("sec-websocket-protocol", "")
        if protocols:
            subprotocol = protocols.split(",")[0].strip()
        await websocket.accept(subprotocol=subprotocol)
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: list):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")
                # We can't remove elements from the list while iterating.
                # Usually we remove them in the websocket handler's except block.

manager = ConnectionManager()
