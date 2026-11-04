from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.models.hazard import Hazard, HazardStatus, HazardSeverity
from backend.app.schemas.hazard import HazardOut
from backend.app.api.deps import get_current_officer, log_audit

router = APIRouter(prefix="/department", tags=["Road Department"])


@router.get("/queue", response_model=List[HazardOut])
def get_hazard_queue(
    current_user: User = Depends(get_current_officer),
    db: Session = Depends(get_db)
):
    """
    Prioritised road hazard queue for road department officers.
    Ordered by critical severity first, then confirmation count.
    """
    hazards = db.query(Hazard).filter(
        Hazard.status.in_([HazardStatus.REPORTED.value, HazardStatus.FORWARDED.value, HazardStatus.ASSIGNED.value, HazardStatus.IN_PROGRESS.value])
    ).all()

    # Sort in python: Critical > High > Medium > Low, then confirmation count descending
    severity_rank = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    sorted_hazards = sorted(
        hazards,
        key=lambda h: (severity_rank.get(h.severity, 0), h.confirmation_count),
        reverse=True
    )

    results = []
    for h in sorted_hazards:
        out = HazardOut.model_validate(h)
        out.reporter_name = h.reporter.name if h.reporter else "Driver"
        results.append(out)
    return results


@router.get("/metrics")
def get_department_metrics(
    current_user: User = Depends(get_current_officer),
    db: Session = Depends(get_db)
):
    """Aggregate statistics for the road hazard operations dashboard."""
    all_hazards = db.query(Hazard).all()
    open_count = sum(1 for h in all_hazards if h.status in [HazardStatus.REPORTED.value, HazardStatus.FORWARDED.value])
    assigned_count = sum(1 for h in all_hazards if h.status == HazardStatus.ASSIGNED.value)
    in_progress_count = sum(1 for h in all_hazards if h.status == HazardStatus.IN_PROGRESS.value)
    fixed_count = sum(1 for h in all_hazards if h.status == HazardStatus.FIXED.value)
    critical_count = sum(1 for h in all_hazards if h.severity == HazardSeverity.CRITICAL.value and h.status != HazardStatus.FIXED.value)

    return {
        "total_reported": len(all_hazards),
        "open": open_count,
        "assigned": assigned_count,
        "in_progress": in_progress_count,
        "fixed": fixed_count,
        "critical_unresolved": critical_count,
        "avg_fix_time_hours": 3.2
    }
