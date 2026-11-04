from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.user import User, UserRole
from backend.app.models.hazard import (
    Hazard,
    HazardStatusHistory,
    HazardConfirmation,
    HazardStatus,
    HazardSeverity,
    HazardType
)
from backend.app.schemas.hazard import (
    HazardCreate,
    HazardOut,
    HazardUpdateStatus,
    HazardVoteRequest,
    HazardStatusHistoryOut
)
from backend.app.api.deps import get_current_user, get_current_officer, log_audit
from backend.app.services.escalation_service import road_dept_workflow

router = APIRouter(prefix="/hazards", tags=["Hazards"])


@router.get("/", response_model=List[HazardOut])
def list_hazards(
    status_filter: Optional[str] = Query(None, alias="status"),
    severity_filter: Optional[str] = Query(None, alias="severity"),
    hazard_type: Optional[str] = Query(None, alias="type"),
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Retrieve road hazards with optional filtering by status, severity, or type."""
    query = db.query(Hazard)
    if status_filter:
        query = query.filter(Hazard.status == status_filter)
    if severity_filter:
        query = query.filter(Hazard.severity == severity_filter)
    if hazard_type:
        query = query.filter(Hazard.hazard_type == hazard_type)
    
    hazards = query.order_by(Hazard.created_at.desc()).limit(limit).all()
    results = []
    for h in hazards:
        out = HazardOut.model_validate(h)
        out.reporter_name = h.reporter.name if h.reporter else "Anonymous Driver"
        results.append(out)
    return results


@router.post("/", response_model=HazardOut, status_code=status.HTTP_201_CREATED)
def report_hazard(
    hazard_in: HazardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Driver reports a road hazard with photo and GPS coordinates."""
    # Check duplicate reports within ~30 meters (0.0003 deg lat/lng)
    threshold = 0.0003
    duplicate = db.query(Hazard).filter(
        Hazard.hazard_type == hazard_in.hazard_type,
        Hazard.status.in_([HazardStatus.REPORTED.value, HazardStatus.FORWARDED.value, HazardStatus.IN_PROGRESS.value]),
        Hazard.latitude.between(hazard_in.latitude - threshold, hazard_in.latitude + threshold),
        Hazard.longitude.between(hazard_in.longitude - threshold, hazard_in.longitude + threshold)
    ).first()

    if duplicate:
        # Merge duplicate: increment confirmation count
        duplicate.confirmation_count += 1
        db.commit()
        db.refresh(duplicate)
        out = HazardOut.model_validate(duplicate)
        out.reporter_name = duplicate.reporter.name if duplicate.reporter else "Driver"
        return out

    hazard = Hazard(
        reporter_id=current_user.id,
        hazard_type=hazard_in.hazard_type,
        severity=hazard_in.severity,
        status=HazardStatus.REPORTED.value,
        title=hazard_in.title,
        description=hazard_in.description,
        latitude=hazard_in.latitude,
        longitude=hazard_in.longitude,
        address=hazard_in.address,
        image_url=hazard_in.image_url,
        confirmation_count=1,
        confidence=0.92
    )
    db.add(hazard)
    db.flush()

    # Initial history record
    history = HazardStatusHistory(
        hazard_id=hazard.id,
        previous_status=None,
        new_status=HazardStatus.REPORTED.value,
        changed_by_user_id=current_user.id,
        notes="Hazard submitted by driver"
    )
    db.add(history)
    db.commit()
    db.refresh(hazard)

    log_audit(db, current_user.id, "HAZARD_REPORTED", "hazard", str(hazard.id), {
        "type": hazard.hazard_type,
        "severity": hazard.severity,
        "lat": hazard.latitude,
        "lng": hazard.longitude
    })

    # Dispatch multi-channel notification to Road Department (PDF Figure 9.1)
    try:
        road_dept_workflow.dispatch_hazard_alert(hazard)
    except Exception as e:
        print(f"[SafeDrive AI] Road Dept Alert notice: {e}")

    out = HazardOut.model_validate(hazard)
    out.reporter_name = current_user.name
    return out


@router.post("/{hazard_id}/vote")
def vote_on_hazard(
    hazard_id: int,
    vote_in: HazardVoteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Drivers vote to confirm if a reported hazard is 'still_there' or 'fixed'."""
    hazard = db.query(Hazard).filter(Hazard.id == hazard_id).first()
    if not hazard:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hazard not found")

    confirmation = HazardConfirmation(
        hazard_id=hazard.id,
        user_id=current_user.id,
        vote=vote_in.vote
    )
    db.add(confirmation)

    if vote_in.vote == "still_there":
        hazard.confirmation_count += 1
    elif vote_in.vote == "fixed" and hazard.confirmation_count > 1:
        hazard.confirmation_count -= 1

    db.commit()
    return {"message": "Vote recorded", "confirmation_count": hazard.confirmation_count}


@router.patch("/{hazard_id}/status", response_model=HazardOut)
def update_hazard_status(
    hazard_id: int,
    status_update: HazardUpdateStatus,
    current_user: User = Depends(get_current_officer),
    db: Session = Depends(get_db)
):
    """Authorized Road Department Officer updates hazard status (assigned, in_progress, fixed)."""
    hazard = db.query(Hazard).filter(Hazard.id == hazard_id).first()
    if not hazard:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hazard not found")

    old_status = hazard.status
    hazard.status = status_update.new_status
    if status_update.proof_image_url:
        hazard.fixed_image_url = status_update.proof_image_url
    if status_update.assigned_officer_id:
        hazard.assigned_officer_id = status_update.assigned_officer_id
    if status_update.assigned_department:
        hazard.assigned_department = status_update.assigned_department

    history = HazardStatusHistory(
        hazard_id=hazard.id,
        previous_status=old_status,
        new_status=status_update.new_status,
        changed_by_user_id=current_user.id,
        notes=status_update.notes,
        proof_image_url=status_update.proof_image_url
    )
    db.add(history)
    db.commit()
    db.refresh(hazard)

    log_audit(db, current_user.id, "HAZARD_STATUS_UPDATED", "hazard", str(hazard.id), {
        "old_status": old_status,
        "new_status": status_update.new_status
    })

    # If marked fixed with after-photo, notify reporting driver (PDF Chapter 9.2)
    if status_update.new_status == HazardStatus.FIXED.value and hazard.reporter:
        try:
            from backend.app.services.escalation_service import notifier
            notifier.send_push(
                recipient=hazard.reporter.email,
                title="Hazard Repair Verified!",
                body=f"Your reported issue '{hazard.title}' has been successfully repaired by the road crew.",
                data={"hazard_id": hazard.id, "proof": status_update.proof_image_url}
            )
        except Exception as e:
            print(f"[SafeDrive AI] Fix notice dispatch error: {e}")

    out = HazardOut.model_validate(hazard)
    out.reporter_name = hazard.reporter.name if hazard.reporter else "Driver"
    return out
