from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.user import User, DriverProfile
from backend.app.models.emergency import EmergencyIncident, IncidentStatus, IncidentType
from backend.app.models.trip import Trip
from backend.app.schemas.emergency import (
    EmergencyTriggerRequest,
    EmergencyAcknowledgeRequest,
    EmergencyIncidentOut
)
from backend.app.api.deps import get_current_user, log_audit
from backend.app.websocket.manager import ws_manager
from backend.app.services.escalation_service import escalation_service

router = APIRouter(prefix="/emergency", tags=["Emergency & SOS"])


@router.post("/trigger", response_model=EmergencyIncidentOut, status_code=status.HTTP_201_CREATED)
async def trigger_emergency(
    req: EmergencyTriggerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Trigger an emergency incident (Manual SOS or Suspected Crash).
    Snapshots driver medical notes and alerts connected caretakers immediately.
    """
    profile = db.query(DriverProfile).filter(DriverProfile.user_id == current_user.id).first()
    medical_data = {}
    if profile:
        medical_data = {
            "blood_group": profile.blood_group,
            "medical_notes": profile.medical_notes,
            "emergency_contact_name": profile.emergency_contact_name,
            "emergency_contact_phone": profile.emergency_contact_phone,
            "driver_phone": current_user.phone
        }

    incident = EmergencyIncident(
        trip_id=req.trip_id,
        driver_id=current_user.id,
        incident_type=req.incident_type,
        status=IncidentStatus.TRIGGERED.value,
        latitude=req.latitude,
        longitude=req.longitude,
        location_address=req.location_address,
        countdown_cancelled=False,
        escalation_level=1,
        medical_snapshot=medical_data,
        notes=req.notes
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    log_audit(db, current_user.id, "EMERGENCY_TRIGGERED", "emergency", str(incident.id), {
        "type": incident.incident_type,
        "lat": incident.latitude,
        "lng": incident.longitude
    })

    # Broadcast emergency broadcast to caretakers
    await ws_manager.broadcast_driver_telemetry(current_user.id, {
        "driver_id": current_user.id,
        "driver_name": current_user.name,
        "safety_status": "emergency",
        "incident_id": incident.id,
        "incident_type": incident.incident_type,
        "latitude": incident.latitude,
        "longitude": incident.longitude,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    # Trigger Level 2 Multi-Channel Caretaker Alert (Push + SMS + Email)
    try:
        escalation_service.process_incident_escalation(db, incident.id, target_level=2)
    except Exception as e:
        print(f"[SafeDrive AI] Escalation dispatch notice: {e}")

    out = EmergencyIncidentOut.model_validate(incident)
    out.driver_name = current_user.name
    return out


@router.post("/{incident_id}/cancel", response_model=EmergencyIncidentOut)
def cancel_emergency_countdown(
    incident_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Driver cancels emergency during countdown window (e.g. false alarm / phone dropped)."""
    incident = db.query(EmergencyIncident).filter(
        EmergencyIncident.id == incident_id,
        EmergencyIncident.driver_id == current_user.id
    ).first()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    incident.status = IncidentStatus.CANCELLED.value
    incident.countdown_cancelled = True
    db.commit()
    db.refresh(incident)

    log_audit(db, current_user.id, "EMERGENCY_CANCELLED", "emergency", str(incident.id))

    out = EmergencyIncidentOut.model_validate(incident)
    out.driver_name = current_user.name
    return out


@router.post("/{incident_id}/acknowledge", response_model=EmergencyIncidentOut)
def acknowledge_emergency(
    incident_id: int,
    ack: EmergencyAcknowledgeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Caretaker or Road Officer acknowledges the emergency incident."""
    incident = db.query(EmergencyIncident).filter(EmergencyIncident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    incident.status = IncidentStatus.ACKNOWLEDGED.value
    incident.acknowledged_by_user_id = current_user.id
    incident.acknowledged_at = datetime.now(timezone.utc)
    if ack.notes:
        incident.notes = (incident.notes or "") + f"\nAcknowledgment note: {ack.notes}"

    db.commit()
    db.refresh(incident)

    log_audit(db, current_user.id, "EMERGENCY_ACKNOWLEDGED", "emergency", str(incident.id))

    out = EmergencyIncidentOut.model_validate(incident)
    out.driver_name = incident.driver.name if incident.driver else "Driver"
    out.acknowledged_by_name = current_user.name
    return out


@router.get("/active", response_model=List[EmergencyIncidentOut])
def get_active_emergencies(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all open/unresolved emergencies."""
    incidents = db.query(EmergencyIncident).filter(
        EmergencyIncident.status.in_([IncidentStatus.TRIGGERED.value, IncidentStatus.ALERTED.value, IncidentStatus.ACKNOWLEDGED.value])
    ).order_by(EmergencyIncident.created_at.desc()).all()

    results = []
    for inc in incidents:
        out = EmergencyIncidentOut.model_validate(inc)
        out.driver_name = inc.driver.name if inc.driver else "Driver"
        if inc.acknowledged_by:
            out.acknowledged_by_name = inc.acknowledged_by.name
        results.append(out)
    return results


@router.post("/{incident_id}/escalate")
def escalate_emergency_step(
    incident_id: int,
    target_level: int = 2,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Executes multi-step emergency escalation:
    Level 2: Caretaker push + SMS + email
    Level 3: Sequential automated phone call
    Level 4: Ambulance dispatch if unacknowledged
    """
    try:
        res = escalation_service.process_incident_escalation(db, incident_id, target_level=target_level)
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
