from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class TripStartRequest(BaseModel):
    vehicle_id: Optional[int] = None
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None
    start_address: Optional[str] = "Current Location"


class TripEndRequest(BaseModel):
    end_lat: Optional[float] = None
    end_lng: Optional[float] = None
    end_address: Optional[str] = "Destination"
    distance_km: Optional[float] = None


class TripLocationCreate(BaseModel):
    latitude: float
    longitude: float
    speed_kmh: float = 0.0
    heading: float = 0.0
    accuracy_m: float = 5.0
    battery_level: float = 100.0
    is_moving: bool = True
    timestamp: Optional[datetime] = None


class TripLocationBatchCreate(BaseModel):
    locations: List[TripLocationCreate]


class TripLocationOut(TripLocationCreate):
    id: int
    trip_id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class DrivingEventCreate(BaseModel):
    event_type: str  # harsh_brake, overspeed, sharp_turn, drowsiness, etc.
    severity: str = "low"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    confidence: float = 0.90
    metadata_json: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None


class DrivingEventOut(DrivingEventCreate):
    id: int
    trip_id: int
    vehicle_id: Optional[int] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class TripOut(BaseModel):
    id: int
    driver_id: int
    vehicle_id: Optional[int] = None
    status: str
    start_time: datetime
    end_time: Optional[datetime] = None
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None
    end_lat: Optional[float] = None
    end_lng: Optional[float] = None
    start_address: Optional[str] = None
    end_address: Optional[str] = None
    distance_km: float
    duration_minutes: float
    avg_speed_kmh: float
    max_speed_kmh: float
    risk_score: float
    risk_level: str
    risk_factors: List[str] = []
    summary_notes: Optional[str] = None

    class Config:
        from_attributes = True


class LiveDriverStatusOut(BaseModel):
    driver_id: int
    driver_name: str
    phone: Optional[str] = None
    active_trip: Optional[TripOut] = None
    last_location: Optional[TripLocationOut] = None
    safety_score: float = 95.0
    safety_status: str = "normal"  # normal, warning, emergency, idle, offline
    vehicle_category: Optional[str] = "car"
    vehicle_label: Optional[str] = None
