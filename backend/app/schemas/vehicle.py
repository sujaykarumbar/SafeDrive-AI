from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel


class VehicleBase(BaseModel):
    category: str  # bike, scooter, car, taxi, truck, bus
    make: str
    model: str
    registration_label: str
    subtype: Optional[str] = None
    is_default: bool = True


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    category: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    registration_label: Optional[str] = None
    subtype: Optional[str] = None
    is_default: Optional[bool] = None


class VehicleOut(VehicleBase):
    id: int
    driver_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class VehicleProfileOut(BaseModel):
    id: int
    category: str
    version: str
    threshold_config: Dict[str, Any]
    description: Optional[str] = None
    effective_from: datetime

    class Config:
        from_attributes = True
