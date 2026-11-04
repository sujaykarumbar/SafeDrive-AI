"""
SafeDrive AI — Phase 4 Automated Verification Tests
Validates:
1. Multi-step Emergency Escalation Flowchart (Chapter 7 & Figure 7.1)
   - Level 1: Crash/SOS trigger & countdown
   - Level 2: Multi-channel Caretaker dispatch (Push + SMS + Email)
   - Level 3: Automated sequential Caretaker Voice Calling
   - Level 4: Timeout Ambulance / Emergency Partner Dispatch
2. Countdown cancellation flow (False alarm / dropped phone handling)
3. Incident Acknowledgment
4. Road Department SOS-style multi-channel alert dispatch by severity (Chapter 9)
5. Verified Hazard Fix workflow with after-photo proof and driver notification
"""

import uuid
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.escalation_service import notifier, escalation_service, road_dept_workflow
from backend.app.db.session import SessionLocal
from backend.app.models.user import User
from backend.app.models.emergency import EmergencyIncident, IncidentStatus
from backend.app.models.hazard import Hazard, HazardStatus, HazardSeverity

client = TestClient(app)


def get_driver_token():
    resp = client.post("/api/v1/auth/login", json={"email": "rahul.driver@safedrive.ai", "password": "SafeDrive@2026"})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def get_officer_token():
    resp = client.post("/api/v1/auth/login", json={"email": "officer.kumar@safedrive.ai", "password": "SafeDrive@2026"})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def test_01_emergency_trigger_and_level2_dispatch():
    """Triggering emergency triggers Level 2 multi-channel caretaker alerts."""
    token = get_driver_token()
    initial_notification_count = len(notifier.dispatched_notifications)

    payload = {
        "incident_type": "suspected_crash",
        "latitude": 12.9750,
        "longitude": 77.6100,
        "location_address": "Near Trinity Circle Flyover Ramp",
        "notes": "Severe G-force spike 4.4g with instantaneous speed collapse."
    }

    resp = client.post(
        "/api/v1/emergency/trigger",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["incident_type"] == "suspected_crash"
    assert data["escalation_level"] >= 1

    # Check notification dispatch (Push, SMS, Email to linked caretakers)
    recent = notifier.dispatched_notifications[initial_notification_count:]
    channels = [n["channel"] for n in recent]
    assert "push" in channels
    assert "email" in channels or "sms" in channels


def test_02_emergency_level3_and_level4_escalation():
    """Escalating to level 3 places voice calls, level 4 dispatches ambulance."""
    token = get_driver_token()

    # Trigger fresh incident
    trig_resp = client.post(
        "/api/v1/emergency/trigger",
        json={"incident_type": "sos_button", "latitude": 12.9716, "longitude": 77.5946},
        headers={"Authorization": f"Bearer {token}"}
    )
    inc_id = trig_resp.json()["id"]

    # Step to Level 3 (Voice Calling)
    l3_resp = client.post(
        f"/api/v1/emergency/{inc_id}/escalate?target_level=3",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert l3_resp.status_code == 200, l3_resp.text
    assert l3_resp.json()["escalation_level"] == 3

    # Step to Level 4 (Ambulance Dispatch)
    l4_resp = client.post(
        f"/api/v1/emergency/{inc_id}/escalate?target_level=4",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert l4_resp.status_code == 200, l4_resp.text
    assert l4_resp.json()["escalation_level"] == 4

    # Verify ambulance dispatch record
    amb_records = [n for n in notifier.dispatched_notifications if n["channel"] == "ambulance_partner"]
    assert len(amb_records) >= 1
    assert amb_records[-1]["incident_id"] == inc_id


def test_03_emergency_cancel_during_countdown():
    """Driver false alarm cancellation during countdown window sets status to CANCELLED."""
    token = get_driver_token()
    trig_resp = client.post(
        "/api/v1/emergency/trigger",
        json={"incident_type": "suspected_crash", "latitude": 12.9716, "longitude": 77.5946},
        headers={"Authorization": f"Bearer {token}"}
    )
    inc_id = trig_resp.json()["id"]

    cancel_resp = client.post(
        f"/api/v1/emergency/{inc_id}/cancel",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert cancel_resp.status_code == 200, cancel_resp.text
    assert cancel_resp.json()["status"] == IncidentStatus.CANCELLED.value
    assert cancel_resp.json()["countdown_cancelled"] is True


def test_04_emergency_acknowledgment():
    """Officer acknowledges incident and appends timeline note."""
    driver_token = get_driver_token()
    officer_token = get_officer_token()

    trig_resp = client.post(
        "/api/v1/emergency/trigger",
        json={"incident_type": "sos_button", "latitude": 12.9716, "longitude": 77.5946},
        headers={"Authorization": f"Bearer {driver_token}"}
    )
    inc_id = trig_resp.json()["id"]

    ack_resp = client.post(
        f"/api/v1/emergency/{inc_id}/acknowledge",
        json={"notes": "Traffic control room operator in contact with patrol unit."},
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert ack_resp.status_code == 200, ack_resp.text
    data = ack_resp.json()
    assert data["status"] == IncidentStatus.ACKNOWLEDGED.value
    assert data["acknowledged_by_name"] is not None


def test_05_road_dept_critical_hazard_dispatch():
    """Reporting a critical fallen tree triggers multi-channel road department alert."""
    token = get_driver_token()
    initial_notification_count = len(notifier.dispatched_notifications)

    unique_offset = (uuid.uuid4().int % 500) * 0.001 + 0.01
    payload = {
        "hazard_type": "fallen_tree",
        "severity": "critical",
        "title": "Large Banyan Tree Branch Blocking Both Lanes",
        "description": "Entire carriageway blocked after heavy storm.",
        "latitude": 12.9810 + unique_offset,
        "longitude": 77.6320 + unique_offset,
        "address": "Indiranagar Double Road"
    }

    resp = client.post(
        "/api/v1/hazards/",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["severity"] == "critical"

    # Multi-channel verification
    recent = notifier.dispatched_notifications[initial_notification_count:]
    dept_alerts = [n for n in recent if "CRITICAL" in n.get("title", "") or "BBMP" in n.get("message", "")]
    assert len(dept_alerts) >= 1


def test_06_verified_hazard_fix_workflow():
    """Officer marks hazard FIXED with proof photo; driver receives confirmation."""
    officer_token = get_officer_token()
    db = SessionLocal()
    try:
        hazard = db.query(Hazard).filter(Hazard.status != HazardStatus.FIXED.value).first()
        assert hazard is not None, "Need at least one open hazard"
        h_id = hazard.id
    finally:
        db.close()

    initial_notification_count = len(notifier.dispatched_notifications)

    resp = client.patch(
        f"/api/v1/hazards/{h_id}/status",
        json={
            "new_status": "fixed",
            "proof_image_url": "https://safedrive.ai/uploads/pothole_fixed_proof.jpg",
            "notes": "Bituminous asphalt patch laid and rolled flat."
        },
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "fixed"
    assert data["fixed_image_url"] is not None

    # Verify push notification sent to driver
    recent = notifier.dispatched_notifications[initial_notification_count:]
    fix_alerts = [n for n in recent if "Verified" in n.get("title", "") or "repaired" in n.get("body", "")]
    assert len(fix_alerts) >= 1
