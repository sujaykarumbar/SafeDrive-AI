from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from backend.app.db.session import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False)  # e.g., "USER_LOGIN", "TRIP_START", "STATUS_CHANGE"
    resource_type = Column(String(50), nullable=True)  # e.g., "trip", "hazard", "user"
    resource_id = Column(String(50), nullable=True)
    details_json = Column(JSON, default=dict)
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    user = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    channel = Column(String(30), default="push")  # push, sms, email, websocket
    title = Column(String(150), nullable=False)
    body = Column(Text, nullable=False)
    payload_json = Column(JSON, default=dict)
    status = Column(String(20), default="sent")  # queued, sent, failed, delivered
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User")
