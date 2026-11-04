import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from backend.app.db.session import Base


class HazardType(str, enum.Enum):
    POTHOLE = "pothole"
    CRACK = "crack"
    WATERLOGGING = "waterlogging"
    FALLEN_TREE = "fallen_tree"
    ACCIDENT = "accident"
    OTHER = "other"


class HazardSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class HazardStatus(str, enum.Enum):
    REPORTED = "reported"
    FORWARDED = "forwarded"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    FIXED = "fixed"
    EXPIRED = "expired"


class Hazard(Base):
    __tablename__ = "hazards"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    hazard_type = Column(String(50), default=HazardType.POTHOLE.value, nullable=False, index=True)
    severity = Column(String(20), default=HazardSeverity.MEDIUM.value, nullable=False, index=True)
    status = Column(String(30), default=HazardStatus.REPORTED.value, nullable=False, index=True)
    
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    address = Column(String(255), nullable=True)
    
    image_url = Column(String(500), nullable=True)
    fixed_image_url = Column(String(500), nullable=True)
    
    assigned_department = Column(String(100), default="Road Maintenance Division")
    assigned_officer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    confirmation_count = Column(Integer, default=1)
    confidence = Column(Float, default=0.92)  # Classifier confidence
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    reporter = relationship("User", foreign_keys=[reporter_id], back_populates="reported_hazards")
    assigned_officer = relationship("User", foreign_keys=[assigned_officer_id])
    status_history = relationship("HazardStatusHistory", back_populates="hazard", cascade="all, delete-orphan", order_by="HazardStatusHistory.timestamp.desc()")
    confirmations = relationship("HazardConfirmation", back_populates="hazard", cascade="all, delete-orphan")


class HazardStatusHistory(Base):
    __tablename__ = "hazard_status_history"

    id = Column(Integer, primary_key=True, index=True)
    hazard_id = Column(Integer, ForeignKey("hazards.id", ondelete="CASCADE"), nullable=False, index=True)
    previous_status = Column(String(30), nullable=True)
    new_status = Column(String(30), nullable=False)
    changed_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    proof_image_url = Column(String(500), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    hazard = relationship("Hazard", back_populates="status_history")
    changed_by = relationship("User")


class HazardConfirmation(Base):
    __tablename__ = "hazard_confirmations"

    id = Column(Integer, primary_key=True, index=True)
    hazard_id = Column(Integer, ForeignKey("hazards.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    vote = Column(String(20), default="still_there", nullable=False)  # "still_there" or "fixed"
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    hazard = relationship("Hazard", back_populates="confirmations")
    user = relationship("User")
