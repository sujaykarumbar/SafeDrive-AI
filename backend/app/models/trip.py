import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean, Text
from sqlalchemy.orm import relationship
from backend.app.db.session import Base


class TripStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Trip(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(String(20), default=TripStatus.ACTIVE.value, nullable=False, index=True)
    
    start_time = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    end_time = Column(DateTime, nullable=True)
    
    start_lat = Column(Float, nullable=True)
    start_lng = Column(Float, nullable=True)
    end_lat = Column(Float, nullable=True)
    end_lng = Column(Float, nullable=True)
    start_address = Column(String(255), nullable=True)
    end_address = Column(String(255), nullable=True)
    
    distance_km = Column(Float, default=0.0)
    duration_minutes = Column(Float, default=0.0)
    avg_speed_kmh = Column(Float, default=0.0)
    max_speed_kmh = Column(Float, default=0.0)
    
    risk_score = Column(Float, default=15.0)  # 0 to 100 risk index
    risk_level = Column(String(20), default=RiskLevel.LOW.value)
    risk_factors = Column(JSON, default=list)  # List of explainable factors
    summary_notes = Column(Text, nullable=True)

    driver = relationship("User", foreign_keys=[driver_id], back_populates="trips")
    vehicle = relationship("Vehicle", back_populates="trips")
    locations = relationship("TripLocation", back_populates="trip", cascade="all, delete-orphan", order_by="TripLocation.timestamp")
    events = relationship("DrivingEvent", back_populates="trip", cascade="all, delete-orphan", order_by="DrivingEvent.timestamp")
    incidents = relationship("EmergencyIncident", back_populates="trip")


class TripLocation(Base):
    __tablename__ = "trip_locations"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    speed_kmh = Column(Float, default=0.0)
    heading = Column(Float, default=0.0)
    accuracy_m = Column(Float, default=5.0)
    battery_level = Column(Float, default=100.0)
    is_moving = Column(Boolean, default=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    trip = relationship("Trip", back_populates="locations")


class DrivingEvent(Base):
    __tablename__ = "driving_events"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(50), nullable=False, index=True)  # harsh_brake, overspeed, etc.
    severity = Column(String(20), default=RiskLevel.LOW.value, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    confidence = Column(Float, default=0.90)
    metadata_json = Column(JSON, default=dict)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    trip = relationship("Trip", back_populates="events")
