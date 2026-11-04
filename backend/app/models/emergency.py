import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, JSON, Text
from sqlalchemy.orm import relationship
from backend.app.db.session import Base


class IncidentType(str, enum.Enum):
    MANUAL_SOS = "manual_sos"
    CRASH_DETECTED = "crash_detected"


class IncidentStatus(str, enum.Enum):
    TRIGGERED = "triggered"
    CANCELLED = "cancelled"
    ALERTED = "alerted"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class EmergencyIncident(Base):
    __tablename__ = "emergency_incidents"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="SET NULL"), nullable=True, index=True)
    driver_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    incident_type = Column(String(50), default=IncidentType.MANUAL_SOS.value, nullable=False)
    status = Column(String(30), default=IncidentStatus.TRIGGERED.value, nullable=False, index=True)
    
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_address = Column(String(255), nullable=True)
    
    countdown_cancelled = Column(Boolean, default=False)
    acknowledged_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    
    escalation_level = Column(Integer, default=1)  # 1: Caretaker push/SMS, 2: Auto-call, 3: Simulated 112/Ambulance
    medical_snapshot = Column(JSON, default=dict)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    trip = relationship("Trip", back_populates="incidents")
    driver = relationship("User", foreign_keys=[driver_id])
    acknowledged_by = relationship("User", foreign_keys=[acknowledged_by_user_id])
