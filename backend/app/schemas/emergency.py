from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel


class EmergencyTriggerRequest(BaseModel):
    trip_id: Optional[int] = None
    incident_type: str = "manual_sos"  # manual_sos or crash_detected
    latitude: float
    longitude: float
    location_address: Optional[str] = "Current Location"
    notes: Optional[str] = None


class EmergencyAcknowledgeRequest(BaseModel):
    notes: Optional[str] = None


class EmergencyIncidentOut(BaseModel):
    id: int
    trip_id: Optional[int] = None
    driver_id: int
    driver_name: Optional[str] = None
    incident_type: str
    status: str
    latitude: float
    longitude: float
    location_address: Optional[str] = None
    countdown_cancelled: bool
    acknowledged_by_user_id: Optional[int] = None
    acknowledged_by_name: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    escalation_level: int
    medical_snapshot: Dict[str, Any] = {}
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
