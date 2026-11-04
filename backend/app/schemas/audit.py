from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details_json: Dict[str, Any] = {}
    ip_address: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class SystemHealthOut(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    environment: str
    database: str = "connected"
    timestamp: datetime
