from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class HazardCreate(BaseModel):
    hazard_type: str  # pothole, crack, waterlogging, fallen_tree, accident, other
    severity: str = "medium"
    title: str
    description: Optional[str] = None
    latitude: float
    longitude: float
    address: Optional[str] = None
    image_url: Optional[str] = None


class HazardUpdateStatus(BaseModel):
    new_status: str  # forwarded, assigned, in_progress, fixed, expired
    notes: Optional[str] = None
    proof_image_url: Optional[str] = None
    assigned_officer_id: Optional[int] = None
    assigned_department: Optional[str] = None


class HazardVoteRequest(BaseModel):
    vote: str  # "still_there" or "fixed"


class HazardStatusHistoryOut(BaseModel):
    id: int
    hazard_id: int
    previous_status: Optional[str] = None
    new_status: str
    changed_by_user_id: Optional[int] = None
    notes: Optional[str] = None
    proof_image_url: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class HazardOut(BaseModel):
    id: int
    reporter_id: Optional[int] = None
    reporter_name: Optional[str] = None
    hazard_type: str
    severity: str
    status: str
    title: str
    description: Optional[str] = None
    latitude: float
    longitude: float
    address: Optional[str] = None
    image_url: Optional[str] = None
    fixed_image_url: Optional[str] = None
    assigned_department: Optional[str] = None
    assigned_officer_id: Optional[int] = None
    confirmation_count: int
    confidence: float
    created_at: datetime
    updated_at: datetime
    status_history: List[HazardStatusHistoryOut] = []

    class Config:
        from_attributes = True
