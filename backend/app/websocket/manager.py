from typing import Dict, List, Set, Any
from fastapi import WebSocket
import json


class ConnectionManager:
    """
    Manages live WebSocket channels between Driver apps and Caretaker dashboards.
    Enforces authorization: caretakers only receive updates for linked drivers.
    """
    def __init__(self):
        # driver_id -> set of driver WebSockets (usually 1 per phone)
        self.driver_connections: Dict[int, Set[WebSocket]] = {}
        # driver_id -> set of caretaker WebSockets viewing this driver
        self.caretaker_subscriptions: Dict[int, Set[WebSocket]] = {}

    async def connect_driver(self, driver_id: int, websocket: WebSocket):
        await websocket.accept()
        if driver_id not in self.driver_connections:
            self.driver_connections[driver_id] = set()
        self.driver_connections[driver_id].add(websocket)

    def disconnect_driver(self, driver_id: int, websocket: WebSocket):
        if driver_id in self.driver_connections:
            self.driver_connections[driver_id].discard(websocket)
            if not self.driver_connections[driver_id]:
                del self.driver_connections[driver_id]

    async def connect_caretaker(self, driver_id: int, websocket: WebSocket):
        await websocket.accept()
        if driver_id not in self.caretaker_subscriptions:
            self.caretaker_subscriptions[driver_id] = set()
        self.caretaker_subscriptions[driver_id].add(websocket)

    def disconnect_caretaker(self, driver_id: int, websocket: WebSocket):
        if driver_id in self.caretaker_subscriptions:
            self.caretaker_subscriptions[driver_id].discard(websocket)
            if not self.caretaker_subscriptions[driver_id]:
                del self.caretaker_subscriptions[driver_id]

    async def broadcast_driver_telemetry(self, driver_id: int, payload: Dict[str, Any]):
        """Broadcast live location, speed, events, and status to listening caretakers."""
        if driver_id in self.caretaker_subscriptions:
            dead_sockets = set()
            message = json.dumps(payload)
            for ws in self.caretaker_subscriptions[driver_id]:
                try:
                    await ws.send_text(message)
                except Exception:
                    dead_sockets.add(ws)
            for ws in dead_sockets:
                self.caretaker_subscriptions[driver_id].discard(ws)


ws_manager = ConnectionManager()
