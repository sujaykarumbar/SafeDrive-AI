import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.security import create_access_token

client = TestClient(app)


def test_health_check():
    """Verify system health endpoint returns status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_admin_health_endpoint():
    """Verify database connectivity in admin health check."""
    response = client.get("/api/v1/admin/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "database" in data


def test_seed_users_login():
    """Verify demo users across all roles can successfully log in."""
    # Driver login
    res = client.post("/api/v1/auth/login", json={
        "email": "rahul.driver@safedrive.ai",
        "password": "SafeDrive@2026"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "driver"

    # Caretaker login
    res = client.post("/api/v1/auth/login", json={
        "email": "priya.caretaker@safedrive.ai",
        "password": "SafeDrive@2026"
    })
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "caretaker"

    # Officer login
    res = client.post("/api/v1/auth/login", json={
        "email": "officer.kumar@safedrive.ai",
        "password": "SafeDrive@2026"
    })
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "officer"


def test_invalid_login():
    """Verify login with incorrect password returns 401."""
    res = client.post("/api/v1/auth/login", json={
        "email": "rahul.driver@safedrive.ai",
        "password": "WrongPassword123!"
    })
    assert res.status_code == 401


import uuid

def test_driver_registration_and_vehicle_flow():
    """Verify driver registration, profile creation, and multi-vehicle setup."""
    uid = uuid.uuid4().hex[:6]
    reg_email = f"new.driver.{uid}@safedrive.ai"
    reg_res = client.post("/api/v1/auth/register", json={
        "email": reg_email,
        "password": "TestPassword@2026",
        "name": "Arjun Patel",
        "phone": "+919123456789",
        "role": "driver"
    })
    assert reg_res.status_code == 201
    driver_token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {driver_token}"}

    # Verify vehicle categories endpoint
    cat_res = client.get("/api/v1/vehicles/categories")
    assert cat_res.status_code == 200
    categories = [c["category"] for c in cat_res.json()]
    for expected in ["bike", "scooter", "car", "taxi", "truck", "bus"]:
        assert expected in categories

    # Add Car vehicle
    car_res = client.post("/api/v1/vehicles/", json={
        "category": "car",
        "make": "Tata",
        "model": "Nexon EV",
        "registration_label": "KA03XY9999",
        "subtype": "Electric",
        "is_default": True
    }, headers=headers)
    assert car_res.status_code == 201
    car_id = car_res.json()["id"]

    # Add Bike vehicle
    bike_res = client.post("/api/v1/vehicles/", json={
        "category": "bike",
        "make": "Honda",
        "model": "CB350",
        "registration_label": "KA03XY1111",
        "subtype": "Petrol",
        "is_default": False
    }, headers=headers)
    assert bike_res.status_code == 201
    bike_id = bike_res.json()["id"]

    # List vehicles
    list_res = client.get("/api/v1/vehicles/", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 2


def test_connected_trip_and_caretaker_monitoring_flow():
    """
    Core Acceptance Flow:
    1. Driver logs in.
    2. Driver starts a simulated trip.
    3. Mobile phone sends batch of GPS points.
    4. Authorised caretaker views driver live status, speed, and location.
    5. Driver ends trip.
    6. Caretaker reviews completed trip in history.
    """
    # 1. Driver Login
    login_driver = client.post("/api/v1/auth/login", json={
        "email": "rahul.driver@safedrive.ai",
        "password": "SafeDrive@2026"
    }).json()
    d_token = login_driver["access_token"]
    d_headers = {"Authorization": f"Bearer {d_token}"}
    driver_id = login_driver["user"]["id"]

    # 2. Start Trip
    start_res = client.post("/api/v1/trips/start", json={
        "start_lat": 12.9716,
        "start_lng": 77.5946,
        "start_address": "MG Road, Bengaluru"
    }, headers=d_headers)
    assert start_res.status_code == 201
    trip_id = start_res.json()["id"]

    # 3. Upload simulated GPS locations batch
    loc_res = client.post(f"/api/v1/trips/{trip_id}/locations", json={
        "locations": [
            {"latitude": 12.9720, "longitude": 77.5970, "speed_kmh": 32.0, "battery_level": 94.0},
            {"latitude": 12.9735, "longitude": 77.6010, "speed_kmh": 45.0, "battery_level": 93.0},
            {"latitude": 12.9750, "longitude": 77.6080, "speed_kmh": 50.0, "battery_level": 92.0}
        ]
    }, headers=d_headers)
    assert loc_res.status_code == 201
    assert loc_res.json()["saved_count"] == 3

    # 4. Caretaker Login & Live View Check
    login_caretaker = client.post("/api/v1/auth/login", json={
        "email": "priya.caretaker@safedrive.ai",
        "password": "SafeDrive@2026"
    }).json()
    c_token = login_caretaker["access_token"]
    c_headers = {"Authorization": f"Bearer {c_token}"}

    monitored = client.get("/api/v1/caretaker/monitored-drivers", headers=c_headers)
    assert monitored.status_code == 200
    monitored_drivers = monitored.json()
    assert len(monitored_drivers) >= 1
    target = next((d for d in monitored_drivers if d["driver_id"] == driver_id), None)
    assert target is not None
    assert target["active_trip"] is not None
    assert target["active_trip"]["id"] == trip_id
    assert target["last_location"]["speed_kmh"] == 50.0

    # 5. End Trip
    end_res = client.post(f"/api/v1/trips/{trip_id}/end", json={
        "end_lat": 12.9750,
        "end_lng": 77.6080,
        "end_address": "Indiranagar, Bengaluru"
    }, headers=d_headers)
    assert end_res.status_code == 200
    assert end_res.json()["status"] == "completed"

    # 6. Caretaker Trip Replay
    replay_res = client.get(f"/api/v1/trips/{trip_id}/replay", headers=c_headers)
    assert replay_res.status_code == 200
    replay_data = replay_res.json()
    assert len(replay_data["path"]) >= 3


def test_caretaker_consent_enforcement():
    """Verify that a caretaker CANNOT access an unlinked driver's live telemetry."""
    uid = uuid.uuid4().hex[:6]
    stranger_email = f"stranger.{uid}@safedrive.ai"
    reg_c = client.post("/api/v1/auth/register", json={
        "email": stranger_email,
        "password": "SafeDrive@2026",
        "name": "Stranger Caretaker",
        "role": "caretaker"
    })
    assert reg_c.status_code == 201
    stranger_data = reg_c.json()
    stranger_headers = {"Authorization": f"Bearer {stranger_data['access_token']}"}

    # Attempt to fetch Rahul's live status without link
    res = client.get("/api/v1/caretaker/drivers/1/live", headers=stranger_headers)
    assert res.status_code == 403


def test_road_department_hazard_workflow():
    """Verify hazard reporting, officer queue inspection, and status transition."""
    # Driver reports hazard
    driver_login = client.post("/api/v1/auth/login", json={
        "email": "rahul.driver@safedrive.ai",
        "password": "SafeDrive@2026"
    }).json()
    d_headers = {"Authorization": f"Bearer {driver_login['access_token']}"}

    rep_res = client.post("/api/v1/hazards/", json={
        "hazard_type": "pothole",
        "severity": "high",
        "title": "Severe pothole at Richmond Circle",
        "description": "Deep asphalt trench causing vehicle steering imbalance.",
        "latitude": 12.9600,
        "longitude": 77.5950,
        "address": "Richmond Circle Flyover"
    }, headers=d_headers)
    assert rep_res.status_code == 201
    hazard_id = rep_res.json()["id"]

    # Road officer logs in
    officer_login = client.post("/api/v1/auth/login", json={
        "email": "officer.kumar@safedrive.ai",
        "password": "SafeDrive@2026"
    }).json()
    o_headers = {"Authorization": f"Bearer {officer_login['access_token']}"}

    # Check officer prioritized queue
    queue_res = client.get("/api/v1/department/queue", headers=o_headers)
    assert queue_res.status_code == 200
    queue = queue_res.json()
    assert any(h["id"] == hazard_id for h in queue)

    # Officer updates status to in_progress
    update_res = client.patch(f"/api/v1/hazards/{hazard_id}/status", json={
        "new_status": "in_progress",
        "notes": "Work crew dispatched with cold-mix asphalt patch truck.",
        "assigned_department": "Zone 2 Highway Maintenance"
    }, headers=o_headers)
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "in_progress"

    # Officer marks as fixed with proof
    fixed_res = client.patch(f"/api/v1/hazards/{hazard_id}/status", json={
        "new_status": "fixed",
        "notes": "Pothole filled, compacted, and leveled smoothly.",
        "proof_image_url": "https://safedrive.ai/proofs/fixed_richmond_01.jpg"
    }, headers=o_headers)
    assert fixed_res.status_code == 200
    assert fixed_res.json()["status"] == "fixed"


def test_emergency_sos_flow():
    """Verify manual SOS trigger, active emergency listing, and acknowledgment."""
    driver_login = client.post("/api/v1/auth/login", json={
        "email": "rahul.driver@safedrive.ai",
        "password": "SafeDrive@2026"
    }).json()
    d_headers = {"Authorization": f"Bearer {driver_login['access_token']}"}

    # Trigger SOS
    sos_res = client.post("/api/v1/emergency/trigger", json={
        "incident_type": "manual_sos",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "location_address": "Near Trinity Metro",
        "notes": "Driver pressed SOS emergency button."
    }, headers=d_headers)
    assert sos_res.status_code == 201
    incident_id = sos_res.json()["id"]
    assert sos_res.json()["status"] in ["triggered", "alerted"]

    # Caretaker acknowledges
    caretaker_login = client.post("/api/v1/auth/login", json={
        "email": "priya.caretaker@safedrive.ai",
        "password": "SafeDrive@2026"
    }).json()
    c_headers = {"Authorization": f"Bearer {caretaker_login['access_token']}"}

    ack_res = client.post(f"/api/v1/emergency/{incident_id}/acknowledge", json={
        "notes": "Caretaker contacted driver via phone; driver confirmed safe."
    }, headers=c_headers)
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "acknowledged"
