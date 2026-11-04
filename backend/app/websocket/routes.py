from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from backend.app.core.security import decode_access_token
from backend.app.db.session import SessionLocal
from backend.app.models.user import User, CaretakerLink, LinkStatus
from backend.app.models.trip import Trip, TripLocation, TripStatus
from backend.app.websocket.manager import ws_manager
import json

ws_router = APIRouter(tags=["WebSockets"])


@ws_router.websocket("/ws/driver/telemetry")
async def driver_telemetry_ws(websocket: WebSocket, token: str = Query(...)):
    """
    Authenticated WebSocket endpoint for driver mobile app.
    Streams live GPS coordinates, speed, battery, and driving events to backend.
    """
    user_id_str = decode_access_token(token)
    if not user_id_str:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    driver_id = int(user_id_str)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == driver_id).first()
        if not user or user.role != "driver":
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        await ws_manager.connect_driver(driver_id, websocket)

        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                # Find driver's active trip
                active_trip = db.query(Trip).filter(
                    Trip.driver_id == driver_id,
                    Trip.status == TripStatus.ACTIVE.value
                ).order_by(Trip.start_time.desc()).first()

                lat = float(payload.get("latitude", 0.0))
                lng = float(payload.get("longitude", 0.0))
                speed = float(payload.get("speed_kmh", 0.0))
                heading = float(payload.get("heading", 0.0))
                battery = float(payload.get("battery_level", 100.0))

                if active_trip and lat != 0.0:
                    loc = TripLocation(
                        trip_id=active_trip.id,
                        latitude=lat,
                        longitude=lng,
                        speed_kmh=speed,
                        heading=heading,
                        battery_level=battery,
                        timestamp=datetime.now(timezone.utc)
                    )
                    db.add(loc)
                    # Update active trip max speed
                    if speed > (active_trip.max_speed_kmh or 0):
                        active_trip.max_speed_kmh = speed
                    db.commit()

                # Broadcast to authorized caretakers in real time
                telemetry_event = {
                    "driver_id": driver_id,
                    "driver_name": user.name,
                    "trip_id": active_trip.id if active_trip else None,
                    "latitude": lat,
                    "longitude": lng,
                    "speed_kmh": speed,
                    "heading": heading,
                    "battery_level": battery,
                    "safety_status": payload.get("safety_status", "normal"),
                    "event": payload.get("event"),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                await ws_manager.broadcast_driver_telemetry(driver_id, telemetry_event)

            except Exception as e:
                # Keep socket alive despite parse errors
                pass

    except WebSocketDisconnect:
        ws_manager.disconnect_driver(driver_id, websocket)
    finally:
        db.close()


@ws_router.websocket("/ws/caretaker/driver/{driver_id}")
async def caretaker_live_stream_ws(websocket: WebSocket, driver_id: int, token: str = Query(...)):
    """
    Authenticated WebSocket endpoint for Caretaker Web Dashboard.
    Enforces driver-caretaker consent check: caretakers can only subscribe to authorized drivers.
    """
    caretaker_id_str = decode_access_token(token)
    if not caretaker_id_str:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    caretaker_id = int(caretaker_id_str)
    db = SessionLocal()
    try:
        # Check permissions: Is caretaker authorized by this driver?
        user = db.query(User).filter(User.id == caretaker_id).first()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # If not admin, check CaretakerLink
        if user.role != "admin":
            link = db.query(CaretakerLink).filter(
                CaretakerLink.driver_id == driver_id,
                CaretakerLink.caretaker_id == caretaker_id,
                CaretakerLink.status == LinkStatus.ACCEPTED.value,
                CaretakerLink.consent_granted == True,
                CaretakerLink.can_view_live == True
            ).first()
            if not link:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return

        await ws_manager.connect_caretaker(driver_id, websocket)

        # Keep alive and receive pings
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        ws_manager.disconnect_caretaker(driver_id, websocket)
    finally:
        db.close()
