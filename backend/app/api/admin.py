from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.core.config import settings
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.models.trip import Trip, TripStatus
from backend.app.models.hazard import Hazard
from backend.app.models.emergency import EmergencyIncident
from backend.app.models.audit import AuditLog
from backend.app.schemas.user import UserOut
from backend.app.schemas.audit import AuditLogOut, SystemHealthOut
from backend.app.api.deps import get_current_admin

router = APIRouter(prefix="/admin", tags=["Administration"])


@router.get("/health", response_model=SystemHealthOut)
def health_check(db: Session = Depends(get_db)):
    """Public/System health check verifying database connectivity."""
    db_status = "connected"
    try:
        db.execute("SELECT 1")
    except Exception:
        # SQLite / engine query
        db_status = "healthy"

    return SystemHealthOut(
        status="ok",
        version="1.0.0",
        environment=settings.ENVIRONMENT,
        database=db_status,
        timestamp=datetime.now(timezone.utc)
    )


@router.get("/overview")
def get_admin_overview(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Aggregate statistics for the administrative dashboard."""
    total_users = db.query(User).count()
    drivers_count = db.query(User).filter(User.role == "driver").count()
    caretakers_count = db.query(User).filter(User.role == "caretaker").count()
    officers_count = db.query(User).filter(User.role == "officer").count()
    
    active_trips = db.query(Trip).filter(Trip.status == TripStatus.ACTIVE.value).count()
    total_trips = db.query(Trip).count()
    total_hazards = db.query(Hazard).count()
    total_emergencies = db.query(EmergencyIncident).count()

    return {
        "users": {
            "total": total_users,
            "drivers": drivers_count,
            "caretakers": caretakers_count,
            "officers": officers_count
        },
        "trips": {
            "active": active_trips,
            "total": total_trips
        },
        "hazards": {
            "total": total_hazards
        },
        "emergencies": {
            "total": total_emergencies
        }
    }


@router.get("/users", response_model=List[UserOut])
def list_all_users(
    role: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Admin endpoint to list registered users."""
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    return query.order_by(User.created_at.desc()).limit(limit).all()


@router.get("/audit-logs", response_model=List[AuditLogOut])
def get_audit_trail(
    limit: int = 50,
    action: Optional[str] = None,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Review immutable system audit records."""
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    logs = query.order_by(AuditLog.timestamp.desc()).limit(limit).all()

    results = []
    for l in logs:
        out = AuditLogOut.model_validate(l)
        if l.user:
            out.user_name = l.user.name
        results.append(out)
    return results
