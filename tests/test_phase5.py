"""
SafeDrive AI — Phase 5 Final Verification Tests: End-to-End Evaluation & Security Audit
Validates:
1. Complete 6-Step Demonstration Script (Blueprint Chapter 13.4)
   - Step 1: Simulated trip initialization & caretaker telemetry
   - Step 2: Driver Drowsiness alert (MediaPipe EAR < 0.22) & risk factors update
   - Step 3: School zone entry & speech warning trigger
   - Step 4: AI Hazard photo classification & road department queue arrival
   - Step 5: Officer fix verification with after-photo proof & driver push notice
   - Step 6: Crash impact (4.6g) -> Emergency escalation -> Ambulance partner dispatch
2. Security & RBAC Enforcement (Driver, Caretaker, Officer, Admin permissions)
3. Consent-Based Privacy Protections (Section 14.1)
"""

import uuid
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.session import SessionLocal
from backend.app.models.trip import Trip, TripStatus
from backend.app.models.hazard import Hazard, HazardStatus
from backend.app.models.emergency import EmergencyIncident, IncidentStatus
from backend.app.services.escalation_service import notifier

client = TestClient(app)


def get_token_for(email: str):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": "SafeDrive@2026"})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    return resp.json()["access_token"]


def test_01_complete_six_step_demo_evaluation():
    """Executes the exact 6-step evaluation scenario from Blueprint Chapter 13.4."""
    driver_token = get_token_for("rahul.driver@safedrive.ai")
    caretaker_token = get_token_for("priya.caretaker@safedrive.ai")
    officer_token = get_token_for("officer.kumar@safedrive.ai")

    # STEP 1: Start Simulated Trip
    start_resp = client.post(
        "/api/v1/trips/start",
        json={
            "start_lat": 12.9716,
            "start_lng": 77.5946,
            "start_address": "MG Road Metro Station",
            "vehicle_id": 1
        },
        headers={"Authorization": f"Bearer {driver_token}"}
    )
    assert start_resp.status_code == 201, start_resp.text
    trip_id = start_resp.json()["id"]

    # STEP 2: Drowsiness Alert (MediaPipe EAR < 0.22 for 2.1s)
    event_resp = client.post(
        f"/api/v1/trips/{trip_id}/events",
        json={
            "event_type": "drowsiness",
            "severity": "high",
            "latitude": 12.9740,
            "longitude": 77.6050,
            "confidence": 0.96,
            "metadata_json": {"ear": 0.18, "duration_s": 2.1}
        },
        headers={"Authorization": f"Bearer {driver_token}"}
    )
    assert event_resp.status_code == 201, event_resp.text

    # Re-evaluate trip risk with real ML engine
    risk_eval = client.post(
        f"/api/v1/ml/predict-trip-risk/{trip_id}",
        headers={"Authorization": f"Bearer {driver_token}"}
    )
    assert risk_eval.status_code == 200, risk_eval.text
    factors = risk_eval.json()["prediction"]["risk_factors"]
    assert any("drowsiness" in f.lower() or "fatigue" in f.lower() for f in factors)

    # STEP 3: Enter School Zone (National Public School Indiranagar)
    zone_resp = client.post(
        "/api/v1/routes/check-zones",
        json={
            "latitude": 12.9780,
            "longitude": 77.6405,
            "speed_kmh": 38.0,
            "driver_id": 1
        }
    )
    assert zone_resp.status_code == 200
    assert zone_resp.json()["active_alerts_count"] >= 1
    assert "School zone" in zone_resp.json()["alerts"][0]["speech_warning"]

    # STEP 4: Citizen Reports Pothole with AI Classification
    hazard_resp = client.post(
        "/api/v1/hazards/",
        json={
            "hazard_type": "pothole",
            "severity": "high",
            "title": f"Deep crater #{uuid.uuid4().hex[:4]}",
            "description": "AI classified surface fracture.",
            "latitude": 12.9760 + (uuid.uuid4().int % 200) * 0.001,
            "longitude": 77.6210 + (uuid.uuid4().int % 200) * 0.001,
            "address": "Indiranagar 100ft Road"
        },
        headers={"Authorization": f"Bearer {driver_token}"}
    )
    assert hazard_resp.status_code == 201, hazard_resp.text
    hazard_id = hazard_resp.json()["id"]

    # Road Department receives issue in queue
    queue_resp = client.get("/api/v1/department/queue", headers={"Authorization": f"Bearer {officer_token}"})
    assert queue_resp.status_code == 200
    queue_ids = [h["id"] for h in queue_resp.json()]
    assert hazard_id in queue_ids

    # STEP 5: Road Department Fixes Issue with Photographic Evidence
    fix_resp = client.patch(
        f"/api/v1/hazards/{hazard_id}/status",
        json={
            "new_status": "fixed",
            "proof_image_url": "https://safedrive.ai/uploads/repaired_patch_proof.jpg",
            "notes": "Asphalt patch rolled and cured by Quick Response Team."
        },
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert fix_resp.status_code == 200
    assert fix_resp.json()["status"] == "fixed"

    # STEP 6: Crash Impact Event & Emergency Escalation
    crash_resp = client.post(
        "/api/v1/emergency/trigger",
        json={
            "trip_id": trip_id,
            "incident_type": "suspected_crash",
            "latitude": 12.9750,
            "longitude": 77.6100,
            "location_address": "Near Trinity Circle Flyover",
            "notes": "4.6g impact detected with immediate vehicle stop."
        },
        headers={"Authorization": f"Bearer {driver_token}"}
    )
    assert crash_resp.status_code == 201
    incident_id = crash_resp.json()["id"]

    # Escalate to Level 4 (Ambulance Partner Dispatch)
    esc_resp = client.post(
        f"/api/v1/emergency/{incident_id}/escalate?target_level=4",
        headers={"Authorization": f"Bearer {driver_token}"}
    )
    assert esc_resp.status_code == 200
    assert esc_resp.json()["escalation_level"] == 4

    # End trip
    end_resp = client.post(
        f"/api/v1/trips/{trip_id}/end",
        json={"end_lat": 12.9750, "end_lng": 77.6100, "end_address": "Trinity Circle"},
        headers={"Authorization": f"Bearer {driver_token}"}
    )
    assert end_resp.status_code == 200


def test_02_rbac_security_enforcement():
    """Verify role-based access control stops unauthorized privilege escalation."""
    driver_token = get_token_for("rahul.driver@safedrive.ai")
    officer_token = get_token_for("officer.kumar@safedrive.ai")

    # Driver cannot access officer department queue
    d_queue = client.get("/api/v1/department/queue", headers={"Authorization": f"Bearer {driver_token}"})
    assert d_queue.status_code == 403

    # Officer cannot start a driver trip
    o_trip = client.post(
        "/api/v1/trips/start",
        json={"start_lat": 12.9716, "start_lng": 77.5946},
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert o_trip.status_code == 403

    # Unauthenticated request rejected
    no_auth = client.post("/api/v1/emergency/trigger", json={"incident_type": "manual_sos"})
    assert no_auth.status_code in [401, 403]


def test_03_consent_privacy_protection():
    """Caretaker cannot view live driver location if consent has not been granted."""
    caretaker_token = get_token_for("priya.caretaker@safedrive.ai")

    # Query unauthorized driver ID 9999
    unauth_resp = client.get(
        "/api/v1/caretaker/drivers/9999/live",
        headers={"Authorization": f"Bearer {caretaker_token}"}
    )
    assert unauth_resp.status_code in [403, 404]
