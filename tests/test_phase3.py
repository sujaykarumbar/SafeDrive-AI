"""
SafeDrive AI — Phase 3 Automated Verification Tests
Validates:
1. Candidate Route Generation (Safest, Fastest, Least Traffic)
2. Safe Route Cost Formula (Chapter 4.1):
   route_cost = distance_time + w1*hazard + w2*zone + w3*traffic + w4*hotspot + w5*weather
   safety_score = 100 - normalised(route_cost - distance_time)
3. Multi-Vehicle Category adaptation (Bike sensitivity vs Car vs Heavy Commercial)
4. Geofencing proximity alerts (School zone active hours, Hospital silence zone, DBSCAN hotspots)
5. Turn-by-turn voice guidance cues
6. Traffic congestion forecast & best departure time recommendation
7. Fast-API endpoints (/routes/directions, /routes/check-zones, /routes/safety-zones, /routes/traffic-forecast)
"""

from datetime import datetime, timezone
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.route_engine import route_engine
from backend.app.services.zone_service import zone_service, haversine_distance_meters
from backend.app.services.traffic_service import traffic_service
from backend.app.db.session import SessionLocal

client = TestClient(app)


def test_01_candidate_routes_generation():
    """Verify 3 candidate routes are produced with distinct profiles and scoring."""
    db = SessionLocal()
    try:
        candidates = route_engine.generate_candidate_routes(
            start_lat=12.9716,
            start_lng=77.5946,
            end_lat=12.9784,
            end_lng=77.6408,
            vehicle_category="car",
            weather="clear",
            db=db
        )
    finally:
        db.close()

    assert len(candidates) == 3
    types = [c["route_type"] for c in candidates]
    assert "safest" in types
    assert "fastest" in types
    assert "least_traffic" in types

    safest = next(c for c in candidates if c["route_type"] == "safest")
    fastest = next(c for c in candidates if c["route_type"] == "fastest")

    assert safest["recommended"] is True
    assert safest["safety_score"] >= fastest["safety_score"]
    assert len(safest["waypoints"]) >= 4
    assert len(safest["turn_by_turn"]) >= 2
    assert "disclaimer" in safest


def test_02_route_cost_formula_adherence():
    """Verify route cost formula strictly sums distance_time plus w1-w5 penalties."""
    test_pts = [[12.9716, 77.5946], [12.9740, 77.6100], [12.9784, 77.6408]]
    res = route_engine.calculate_route_cost(
        waypoints=test_pts,
        base_distance_km=6.0,
        base_duration_min=15.0,
        vehicle_category="car",
        weather="rain"
    )

    penalties = res["penalties"]
    expected_sum = (
        penalties["distance_time_cost"] +
        penalties["hazard_penalty"] +
        penalties["zone_penalty"] +
        penalties["traffic_penalty"] +
        penalties["hotspot_penalty"] +
        penalties["night_weather_pen"]
    )
    assert abs(res["route_cost"] - round(expected_sum, 1)) < 0.2
    assert 0.0 <= res["safety_score"] <= 100.0


def test_03_multi_vehicle_adaptation():
    """Two-wheelers should incur higher penalty in rain and around surface damage than cars."""
    test_pts = [[12.9716, 77.5946], [12.9760, 77.6210]]  # Near Indiranagar corridor

    bike_cost = route_engine.calculate_route_cost(
        waypoints=test_pts,
        base_distance_km=5.0,
        base_duration_min=12.0,
        vehicle_category="bike",
        weather="rain"
    )

    car_cost = route_engine.calculate_route_cost(
        waypoints=test_pts,
        base_distance_km=5.0,
        base_duration_min=12.0,
        vehicle_category="car",
        weather="rain"
    )

    # Two-wheeler rain/weather penalty is elevated in blueprint addendum
    assert bike_cost["penalties"]["night_weather_pen"] >= car_cost["penalties"]["night_weather_pen"]


def test_04_zone_geofencing_and_overspeed():
    """Driver within NPS Indiranagar school zone at 45 km/h receives active warning and overspeed flag."""
    # School coordinates: 12.9780, 77.6405
    alerts = zone_service.check_proximity(
        latitude=12.9782,
        longitude=77.6407,
        current_speed_kmh=42.0,
        driver_id=999
    )

    assert len(alerts) >= 1
    school_alert = next((a for a in alerts if a["zone_type"] == "school"), None)
    assert school_alert is not None
    assert school_alert["speed_limit_kmh"] in [25, 35]
    assert school_alert["is_overspeed"] is True
    assert "School" in school_alert["speech_warning"]


def test_05_zone_alert_rate_limiting():
    """Immediate re-entry to the same zone within 3 minutes should mark alert as suppressed."""
    # First alert
    zone_service.check_proximity(latitude=12.9592, longitude=77.6534, driver_id=888)  # Manipal hospital
    # Second immediate check
    alerts = zone_service.check_proximity(latitude=12.9592, longitude=77.6534, driver_id=888)
    hospital_alert = next((a for a in alerts if a["zone_id"] == "hospital_manipal_oldairport"), None)
    assert hospital_alert is not None
    assert hospital_alert["is_suppressed"] is True


def test_06_traffic_forecast_and_departure_time():
    """Forecast returns 60-min intervals and valid departure advice."""
    fc = traffic_service.forecast_traffic_window(weather="clear")
    assert "forecast_intervals" in fc
    assert len(fc["forecast_intervals"]) == 5  # 0, 15, 30, 45, 60
    assert "best_departure_time" in fc
    assert "recommendation" in fc


def test_07_api_get_directions():
    """Test GET /api/v1/routes/directions endpoint."""
    resp = client.get("/api/v1/routes/directions?start_lat=12.9716&start_lng=77.5946&end_lat=12.9784&end_lng=77.6408&vehicle_category=car")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "candidate_routes" in data
    assert len(data["candidate_routes"]) == 3
    assert data["candidate_routes"][0]["route_type"] == "safest"
    assert "traffic_forecast" in data


def test_08_api_check_zones():
    """Test POST /api/v1/routes/check-zones endpoint."""
    resp = client.post("/api/v1/routes/check-zones", json={
        "latitude": 12.9780,
        "longitude": 77.6405,
        "speed_kmh": 40.0,
        "driver_id": 123
    })
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "alerts" in data
    assert data["active_alerts_count"] >= 1


def test_09_api_safety_zones_list():
    """Test GET /api/v1/routes/safety-zones endpoint."""
    resp = client.get("/api/v1/routes/safety-zones")
    assert resp.status_code == 200
    zones = resp.json()
    assert len(zones) >= 5
    types = [z["zone_type"] for z in zones]
    assert "school" in types
    assert "hospital" in types
    assert "accident_hotspot" in types
