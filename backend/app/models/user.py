import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from backend.app.db.session import Base


class UserRole(str, enum.Enum):
    DRIVER = "driver"
    CARETAKER = "caretaker"
    OFFICER = "officer"
    ADMIN = "admin"


class LinkStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REVOKED = "revoked"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(50), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default=UserRole.DRIVER.value, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    driver_profile = relationship("DriverProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    vehicles = relationship("Vehicle", back_populates="driver", cascade="all, delete-orphan")
    trips = relationship("Trip", back_populates="driver", foreign_keys="Trip.driver_id")
    reported_hazards = relationship("Hazard", back_populates="reporter", foreign_keys="Hazard.reporter_id")
    
    # Caretaker relationships
    caretaker_links_as_driver = relationship("CaretakerLink", back_populates="driver", foreign_keys="CaretakerLink.driver_id")
    caretaker_links_as_caretaker = relationship("CaretakerLink", back_populates="caretaker", foreign_keys="CaretakerLink.caretaker_id")


class DriverProfile(Base):
    __tablename__ = "driver_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    license_number = Column(String(50), nullable=True)
    blood_group = Column(String(10), nullable=True)  # e.g., O+, A-, etc.
    medical_notes = Column(Text, nullable=True)      # e.g., allergies, conditions
    emergency_contact_name = Column(String(100), nullable=True)
    emergency_contact_phone = Column(String(50), nullable=True)
    current_safety_score = Column(Float, default=95.0)  # 0 to 100
    total_distance_km = Column(Float, default=0.0)
    total_trips = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="driver_profile")


class CaretakerLink(Base):
    __tablename__ = "caretaker_links"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    caretaker_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), default=LinkStatus.ACCEPTED.value, nullable=False)
    invite_code = Column(String(20), nullable=True, index=True)
    consent_granted = Column(Boolean, default=True, nullable=False)
    can_view_live = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    driver = relationship("User", foreign_keys=[driver_id], back_populates="caretaker_links_as_driver")
    caretaker = relationship("User", foreign_keys=[caretaker_id], back_populates="caretaker_links_as_caretaker")
