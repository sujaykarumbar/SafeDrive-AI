import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from backend.app.db.session import Base


class VehicleCategory(str, enum.Enum):
    BIKE = "bike"
    SCOOTER = "scooter"
    CAR = "car"
    TAXI = "taxi"
    TRUCK = "truck"
    BUS = "bus"


class VehicleProfile(Base):
    """
    Versioned threshold configurations per vehicle category.
    Allows fair, vehicle-aware safety analysis without hardcoding static rules.
    """
    __tablename__ = "vehicle_profiles"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(30), unique=True, nullable=False, index=True)
    version = Column(String(20), default="1.0.0", nullable=False)
    # Stored as JSON: max_speed_kmh, harsh_brake_g, harsh_accel_g, sharp_turn_deg, break_interval_min
    threshold_config = Column(JSON, nullable=False)
    description = Column(Text, nullable=True)
    effective_from = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(30), default=VehicleCategory.CAR.value, nullable=False)
    make = Column(String(50), nullable=False)           # e.g., Hyundai, Tata, Honda
    model = Column(String(50), nullable=False)          # e.g., Creta, Nexon, Activa
    registration_label = Column(String(30), nullable=False)  # e.g., KA01AB1234
    subtype = Column(String(50), nullable=True)         # e.g., Electric, Diesel, Heavy Commercial
    is_default = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    driver = relationship("User", back_populates="vehicles")
    trips = relationship("Trip", back_populates="vehicle")
