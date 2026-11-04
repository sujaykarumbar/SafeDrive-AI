from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: EmailStr
    name: str
    phone: Optional[str] = None
    role: str = "driver"


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class DriverProfileBase(BaseModel):
    license_number: Optional[str] = None
    blood_group: Optional[str] = None
    medical_notes: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class DriverProfileCreate(DriverProfileBase):
    pass


class DriverProfileUpdate(DriverProfileBase):
    pass


class DriverProfileOut(DriverProfileBase):
    id: int
    user_id: int
    current_safety_score: float
    total_distance_km: float
    total_trips: int
    created_at: datetime

    class Config:
        from_attributes = True


class CaretakerLinkCreate(BaseModel):
    caretaker_email: EmailStr
    can_view_live: bool = True


class CaretakerLinkOut(BaseModel):
    id: int
    driver_id: int
    caretaker_id: int
    driver_name: Optional[str] = None
    caretaker_name: Optional[str] = None
    caretaker_email: Optional[str] = None
    status: str
    invite_code: Optional[str] = None
    consent_granted: bool
    can_view_live: bool
    created_at: datetime

    class Config:
        from_attributes = True


class InviteAcceptRequest(BaseModel):
    invite_code: str
