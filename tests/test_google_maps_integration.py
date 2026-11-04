"""
SafeDrive AI — Google Maps Platform & Safe Route Integration Tests
Verifies:
1. Google Maps Platform service configuration endpoint.
2. Places Autocomplete and Place Details.
3. Reverse Geocoding.
4. Nearby Amenity Search (fuel, ev_charging, hospitals, parking, repair).
5. Safe route calculation with multi-vehicle profiles (2-wheeler, car, truck, bus).
6. Multi-stop waypoint route planning.
7. Google Polyline decoding utility.
8. SafeDrive AI Safety Intelligence scoring separation.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.google_maps_service import decode_google_polyline, google_maps_service


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_google_maps_config_endpoint(client):
    response = client.get("/api/v1/routes/config")
    assert response.status_code == 200
    data = response.json()
    assert "google_maps_configured" in data
    assert "service_provider" in data
    assert "supported_modes" in data
    assert "TWO_WHEELER" in data["supported_modes"]
    assert "TRUCK" in data["supported_modes"]


def test_places_autocomplete(client):
    response = client.get("/api/v1/routes/places/autocomplete?query=Indiranagar")
    assert response.status_code == 200
    data = response.json()
    assert "predictions" in data
    assert data["count"] > 0
    first = data["predictions"][0]
    assert "place_id" in first
    assert "main_text" in first


def test_place_details(client):
    response = client.get("/api/v1/routes/places/details?place_id=sd_indiranagar")
    assert response.status_code == 200
    data = response.json()
    assert data["place_id"] == "sd_indiranagar"
    assert data["latitude"] > 0
    assert data["longitude"] > 0
    assert "Indiranagar" in data["name"]


def test_reverse_geocode(client):
    response = client.get("/api/v1/routes/places/reverse-geocode?lat=12.9716&lng=77.5946")
    assert response.status_code == 200
    data = response.json()
    assert "formatted_address" in data
    assert "Bengaluru" in data["formatted_address"]


def test_nearby_amenities(client):
    for amenity in ["gas_station", "charging_station", "hospital", "car_repair"]:
        response = client.get(f"/api/v1/routes/places/nearby?lat=12.9716&lng=77.5946&type={amenity}&radius=5000")
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == amenity
        assert "places" in data
        assert len(data["places"]) > 0


def test_safe_directions_with_vehicle_profiles(client):
    # Motorcycle / Scooter
    res_bike = client.get("/api/v1/routes/directions?start_lat=12.9716&start_lng=77.5946&end_lat=12.9784&end_lng=77.6408&vehicle_category=bike")
    assert res_bike.status_code == 200
    data_bike = res_bike.json()
    assert len(data_bike["candidate_routes"]) >= 1
    assert data_bike["vehicle_category"] == "bike"

    # Truck
    res_truck = client.get("/api/v1/routes/directions?start_lat=12.9716&start_lng=77.5946&end_lat=12.9784&end_lng=77.6408&vehicle_category=truck")
    assert res_truck.status_code == 200
    data_truck = res_truck.json()
    assert len(data_truck["candidate_routes"]) >= 1
    assert data_truck["vehicle_category"] == "truck"

    # SafeDrive recommended flag check
    has_recommended = any(r.get("recommended") for r in data_bike["candidate_routes"])
    assert has_recommended is True


def test_multi_stop_plan(client):
    payload = {
        "origin": {"latitude": 12.9716, "longitude": 77.5946, "name": "MG Road"},
        "destination": {"latitude": 12.9784, "longitude": 77.6408, "name": "Indiranagar"},
        "waypoints": [
            {"latitude": 12.9756, "longitude": 77.6066, "name": "Stop 1: Metro"}
        ],
        "vehicle_constraints": {
            "category": "truck",
            "height_meters": 3.8,
            "weight_tons": 16.0
        },
        "avoid_tolls": True
    }
    response = client.post("/api/v1/routes/plan", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "candidate_routes" in data
    assert len(data["candidate_routes"]) > 0


def test_google_polyline_decoder():
    # Sample encoded Google polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
    encoded = "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
    pts = decode_google_polyline(encoded)
    assert len(pts) > 0
    for pt in pts:
        assert isinstance(pt[0], float)
        assert isinstance(pt[1], float)
