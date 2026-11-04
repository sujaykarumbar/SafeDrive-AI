import math
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.user import User, DriverProfile
from backend.app.models.vehicle import Vehicle
from backend.app.models.trip import Trip, TripLocation, DrivingEvent, TripStatus, RiskLevel
from backend.app.schemas.trip import (
    TripStartRequest,
    TripEndRequest,
    TripOut,
    TripLocationCreate,
    TripLocationBatchCreate,
    TripLocationOut,
    DrivingEventCreate,
    DrivingEventOut
)
from backend.app.api.deps import get_current_user, get_current_driver, log_audit
from backend.app.websocket.manager import ws_manager

router = APIRouter(prefix="/trips", tags=["Trips"])


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two GPS coordinates in kilometers."""
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


@router.post("/start", response_model=TripOut, status_code=status.HTTP_201_CREATED)
def start_trip(
    trip_in: TripStartRequest,
    current_user: User = Depends(get_current_driver),
    db: Session = Depends(get_db)
):
    """Start an active trip session for the authenticated driver."""
    # Check if driver already has an active trip
    existing = db.query(Trip).filter(
        Trip.driver_id == current_user.id,
        Trip.status == TripStatus.ACTIVE.value
    ).first()
    if existing:
        return existing

    # Find vehicle to attach
    vehicle_id = trip_in.vehicle_id
    if not vehicle_id:
        default_vehicle = db.query(Vehicle).filter(
            Vehicle.driver_id == current_user.id,
            Vehicle.is_default == True
        ).first()
        if default_vehicle:
            vehicle_id = default_vehicle.id

    trip = Trip(
        driver_id=current_user.id,
        vehicle_id=vehicle_id,
        status=TripStatus.ACTIVE.value,
        start_time=datetime.now(timezone.utc),
        start_lat=trip_in.start_lat,
        start_lng=trip_in.start_lng,
        start_address=trip_in.start_address,
        distance_km=0.0,
        duration_minutes=0.0,
        risk_score=10.0,  # Starts with clean low risk
        risk_level=RiskLevel.LOW.value,
        risk_factors=[]
    )
    db.add(trip)
    db.flush()

    if trip_in.start_lat is not None and trip_in.start_lng is not None:
        initial_loc = TripLocation(
            trip_id=trip.id,
            latitude=trip_in.start_lat,
            longitude=trip_in.start_lng,
            speed_kmh=0.0,
            heading=0.0,
            timestamp=datetime.now(timezone.utc)
        )
        db.add(initial_loc)

    db.commit()
    db.refresh(trip)

    log_audit(db, current_user.id, "TRIP_STARTED", "trip", str(trip.id), {
        "vehicle_id": vehicle_id,
        "start_address": trip_in.start_address
    })

    return trip


@router.post("/{trip_id}/end", response_model=TripOut)
def end_trip(
    trip_id: int,
    trip_end: TripEndRequest,
    current_user: User = Depends(get_current_driver),
    db: Session = Depends(get_db)
):
    """End an active trip, compute aggregates, and update driver profile."""
    trip = db.query(Trip).filter(
        Trip.id == trip_id,
        Trip.driver_id == current_user.id
    ).first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    if trip.status != TripStatus.ACTIVE.value:
        return trip

    end_time = datetime.now(timezone.utc)
    trip.end_time = end_time
    trip.status = TripStatus.COMPLETED.value
    trip.end_lat = trip_end.end_lat
    trip.end_lng = trip_end.end_lng
    trip.end_address = trip_end.end_address

    # Duration in minutes
    if trip.start_time:
        duration_sec = (end_time - trip.start_time.replace(tzinfo=timezone.utc)).total_seconds()
        trip.duration_minutes = round(max(1.0, duration_sec / 60.0), 1)

    # Compute distance if locations exist
    locations = db.query(TripLocation).filter(TripLocation.trip_id == trip.id).order_by(TripLocation.timestamp).all()
    if len(locations) > 1:
        total_dist = 0.0
        speeds = []
        for i in range(1, len(locations)):
            total_dist += haversine_distance(
                locations[i-1].latitude, locations[i-1].longitude,
                locations[i].latitude, locations[i].longitude
            )
            speeds.append(locations[i].speed_kmh)
        trip.distance_km = round(total_dist, 2)
        if speeds:
            trip.avg_speed_kmh = round(sum(speeds) / len(speeds), 1)
            trip.max_speed_kmh = round(max(speeds), 1)
    elif trip_end.distance_km:
        trip.distance_km = round(trip_end.distance_km, 2)

    # Update driver cumulative stats
    profile = db.query(DriverProfile).filter(DriverProfile.user_id == current_user.id).first()
    if profile:
        profile.total_trips = (profile.total_trips or 0) + 1
        profile.total_distance_km = round((profile.total_distance_km or 0.0) + trip.distance_km, 2)

    db.commit()
    db.refresh(trip)

    log_audit(db, current_user.id, "TRIP_COMPLETED", "trip", str(trip.id), {
        "distance_km": trip.distance_km,
        "duration_minutes": trip.duration_minutes
    })

    return trip


@router.post("/{trip_id}/locations", status_code=status.HTTP_201_CREATED)
async def upload_locations_batch(
    trip_id: int,
    batch: TripLocationBatchCreate,
    current_user: User = Depends(get_current_driver),
    db: Session = Depends(get_db)
):
    """
    Batch upload GPS locations from mobile app.
    Persists points and immediately broadcasts latest telemetry to authorized caretakers.
    """
    trip = db.query(Trip).filter(
        Trip.id == trip_id,
        Trip.driver_id == current_user.id
    ).first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    new_locations = []
    latest_pt = None
    for loc in batch.locations:
        ts = loc.timestamp or datetime.now(timezone.utc)
        record = TripLocation(
            trip_id=trip.id,
            latitude=loc.latitude,
            longitude=loc.longitude,
            speed_kmh=loc.speed_kmh,
            heading=loc.heading,
            accuracy_m=loc.accuracy_m,
            battery_level=loc.battery_level,
            is_moving=loc.is_moving,
            timestamp=ts
        )
        new_locations.append(record)
        latest_pt = loc

    if new_locations:
        db.bulk_save_objects(new_locations)
        db.commit()

        # Broadcast latest telemetry to Caretaker WebSockets
        if latest_pt:
            await ws_manager.broadcast_driver_telemetry(current_user.id, {
                "driver_id": current_user.id,
                "driver_name": current_user.name,
                "trip_id": trip.id,
                "latitude": latest_pt.latitude,
                "longitude": latest_pt.longitude,
                "speed_kmh": latest_pt.speed_kmh,
                "heading": latest_pt.heading,
                "battery_level": latest_pt.battery_level,
                "safety_status": "normal",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

    return {"saved_count": len(new_locations)}


@router.post("/{trip_id}/events", response_model=DrivingEventOut, status_code=status.HTTP_201_CREATED)
def record_driving_event(
    trip_id: int,
    event_in: DrivingEventCreate,
    current_user: User = Depends(get_current_driver),
    db: Session = Depends(get_db)
):
    """Record a detected driving event (e.g. harsh braking, overspeed, sharp turn)."""
    trip = db.query(Trip).filter(
        Trip.id == trip_id,
        Trip.driver_id == current_user.id
    ).first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    event = DrivingEvent(
        trip_id=trip.id,
        vehicle_id=trip.vehicle_id,
        event_type=event_in.event_type,
        severity=event_in.severity,
        latitude=event_in.latitude,
        longitude=event_in.longitude,
        confidence=event_in.confidence,
        metadata_json=event_in.metadata_json or {},
        timestamp=event_in.timestamp or datetime.now(timezone.utc)
    )
    db.add(event)

    # Adjust trip risk score on events
    penalty = 5.0 if event_in.severity == "low" else (12.0 if event_in.severity == "medium" else 20.0)
    trip.risk_score = min(100.0, (trip.risk_score or 10.0) + penalty)
    if trip.risk_score > 60:
        trip.risk_level = RiskLevel.HIGH.value
    elif trip.risk_score > 30:
        trip.risk_level = RiskLevel.MEDIUM.value

    db.commit()
    db.refresh(event)
    return event


@router.get("/active", response_model=Optional[TripOut])
def get_active_trip(
    current_user: User = Depends(get_current_driver),
    db: Session = Depends(get_db)
):
    """Return driver's currently ongoing trip, if any."""
    trip = db.query(Trip).filter(
        Trip.driver_id == current_user.id,
        Trip.status == TripStatus.ACTIVE.value
    ).order_by(Trip.start_time.desc()).first()
    return trip


@router.get("/history", response_model=List[TripOut])
def get_trip_history(
    limit: int = 20,
    skip: int = 0,
    current_user: User = Depends(get_current_driver),
    db: Session = Depends(get_db)
):
    """Return driver's historical completed trips."""
    trips = db.query(Trip).filter(
        Trip.driver_id == current_user.id,
        Trip.status != TripStatus.ACTIVE.value
    ).order_by(Trip.start_time.desc()).offset(skip).limit(limit).all()
    return trips


@router.get("/{trip_id}", response_model=TripOut)
def get_trip_detail(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get single trip details."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    return trip


@router.get("/{trip_id}/replay")
def get_trip_replay_data(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return GPS coordinates and driving events formatted for map trajectory replay."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    locations = db.query(TripLocation).filter(
        TripLocation.trip_id == trip.id
    ).order_by(TripLocation.timestamp.asc()).all()

    events = db.query(DrivingEvent).filter(
        DrivingEvent.trip_id == trip.id
    ).order_by(DrivingEvent.timestamp.asc()).all()

    return {
        "trip": TripOut.model_validate(trip),
        "path": [
            {
                "lat": loc.latitude,
                "lng": loc.longitude,
                "speed": loc.speed_kmh,
                "heading": loc.heading,
                "battery": loc.battery_level,
                "timestamp": loc.timestamp.isoformat()
            }
            for loc in locations
        ],
        "events": [
            {
                "type": e.event_type,
                "severity": e.severity,
                "lat": e.latitude,
                "lng": e.longitude,
                "timestamp": e.timestamp.isoformat()
            }
            for e in events
        ]
    }
