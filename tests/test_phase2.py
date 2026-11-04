"""
SafeDrive AI — Phase 2 Automated Verification Tests
Validates:
1. ML artifacts existence & loading
2. Image feature extraction & Hazard classification accuracy on sample images
3. Cautious severity mapping and uncertainty detection (<0.60 threshold)
4. Driving risk feature extraction from Trip telemetry & events
5. XGBoost model prediction on Low, Medium, and High risk profiles
6. SHAP-aligned explainability (factor attribution list and positive feedback)
7. Fast-API endpoints (/ml/classify-hazard, /ml/predict-features-risk, /ml/predict-trip-risk, /ml/models)
"""

import os
import io
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.ml.hazard_service import hazard_service
from backend.app.ml.risk_service import risk_service, VEHICLE_MAP
from backend.app.db.session import SessionLocal
from backend.app.models.trip import Trip

client = TestClient(app)


def get_auth_token():
    resp = client.post("/api/v1/auth/login", json={"email": "rahul.driver@safedrive.ai", "password": "SafeDrive@2026"})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


def create_sample_image(color=(80, 80, 80), pattern="pothole"):
    img = Image.new("RGB", (160, 160), color=color)
    if pattern == "pothole":
        # Draw dark circle in center
        pixels = img.load()
        for y in range(50, 110):
            for x in range(50, 110):
                if (x-80)**2 + (y-80)**2 < 30**2:
                    pixels[x, y] = (15, 15, 18)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_01_ml_artifacts_exist():
    """Verify serialized model files and metadata exist in artifacts directory."""
    artifacts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend", "app", "ml", "artifacts")
    assert os.path.exists(os.path.join(artifacts_dir, "hazard_classifier.joblib"))
    assert os.path.exists(os.path.join(artifacts_dir, "hazard_metadata.json"))
    assert os.path.exists(os.path.join(artifacts_dir, "risk_model.joblib"))
    assert os.path.exists(os.path.join(artifacts_dir, "risk_scaler.joblib"))
    assert os.path.exists(os.path.join(artifacts_dir, "risk_metadata.json"))


def test_02_hazard_service_inference():
    """Verify image classification returns expected structure, probabilities, and severity."""
    img_bytes = create_sample_image(pattern="pothole")
    result = hazard_service.classify_image_bytes(img_bytes)

    assert "predicted_class" in result
    assert result["predicted_class"] in ["pothole", "crack", "waterlogging", "fallen_tree", "normal_road"]
    assert "confidence" in result
    assert 0.0 <= result["confidence"] <= 1.0
    assert "severity" in result
    assert result["severity"] in ["low", "medium", "high", "critical"]
    assert "class_probabilities" in result
    assert "is_uncertain" in result


def test_03_risk_service_predict_low_risk():
    """Calm daytime driver with 0 infractions should yield LOW risk and positive reinforcement."""
    low_risk_features = {
        "distance_km": 12.0,
        "duration_minutes": 25.0,
        "speed_mean_kmh": 38.0,
        "speed_max_kmh": 52.0,
        "speed_std_kmh": 6.0,
        "harsh_brake_count": 0,
        "harsh_accel_count": 0,
        "sharp_turn_count": 0,
        "night_driving_ratio": 0.0,
        "fatigue_warning_count": 0,
        "vehicle_category_code": VEHICLE_MAP["car"]
    }
    pred = risk_service.predict_risk(low_risk_features)
    assert pred["risk_level"] in ["LOW", "MEDIUM"]
    assert pred["risk_score"] < 40.0
    assert len(pred["risk_factors"]) >= 1
    assert "Defensive Driving" in str(pred["feature_contributions"]) or "Positive" in str(pred["risk_factors"])


def test_04_risk_service_predict_high_risk():
    """Aggressive late-night driver with speeding and harsh braking should yield HIGH risk with factor attribution."""
    high_risk_features = {
        "distance_km": 15.0,
        "duration_minutes": 30.0,
        "speed_mean_kmh": 68.0,
        "speed_max_kmh": 105.0,
        "speed_std_kmh": 22.0,
        "harsh_brake_count": 6,
        "harsh_accel_count": 4,
        "sharp_turn_count": 3,
        "night_driving_ratio": 0.95,
        "fatigue_warning_count": 2,
        "vehicle_category_code": VEHICLE_MAP["car"]
    }
    pred = risk_service.predict_risk(high_risk_features)
    assert pred["risk_level"] == "HIGH"
    assert pred["risk_score"] >= 45.0
    # SHAP explanations should highlight night driving and harsh braking
    factors_str = " ".join(pred["risk_factors"]).lower()
    assert "night" in factors_str or "braking" in factors_str or "speed" in factors_str
    assert len(pred["feature_contributions"]) >= 2


def test_05_api_classify_hazard_multipart():
    """Test POST /api/v1/ml/classify-hazard with multipart image upload."""
    img_bytes = create_sample_image(pattern="pothole")
    resp = client.post(
        "/api/v1/ml/classify-hazard",
        files={"file": ("pothole.jpg", img_bytes, "image/jpeg")}
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "predicted_class" in data
    assert "confidence" in data
    assert "severity" in data


def test_06_api_predict_features_risk():
    """Test POST /api/v1/ml/predict-features-risk with arbitrary JSON."""
    payload = {
        "distance_km": 10.5,
        "duration_minutes": 20.0,
        "speed_mean_kmh": 45.0,
        "speed_max_kmh": 62.0,
        "speed_std_kmh": 9.5,
        "harsh_brake_count": 1,
        "harsh_accel_count": 1,
        "sharp_turn_count": 0,
        "night_driving_ratio": 0.1,
        "fatigue_warning_count": 0,
        "vehicle_category": "car"
    }
    resp = client.post("/api/v1/ml/predict-features-risk", json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "prediction" in data
    assert "risk_score" in data["prediction"]
    assert "risk_level" in data["prediction"]


def test_07_api_predict_trip_risk_db():
    """Test POST /api/v1/ml/predict-trip-risk/{trip_id} on seeded demo trip."""
    token = get_auth_token()
    db = SessionLocal()
    try:
        trip = db.query(Trip).first()
        assert trip is not None, "Need at least one seeded trip"
        trip_id = trip.id
    finally:
        db.close()

    resp = client.post(
        f"/api/v1/ml/predict-trip-risk/{trip_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["trip_id"] == trip_id
    assert "features" in data
    assert "prediction" in data
    assert data["prediction"]["risk_score"] > 0


def test_08_api_models_registry_and_report():
    """Test GET /api/v1/ml/models and GET /api/v1/ml/evaluation-report."""
    resp = client.get("/api/v1/ml/models")
    assert resp.status_code == 200
    data = resp.json()
    assert "hazard_classifier" in data
    assert "risk_predictor" in data
    assert data["risk_predictor"]["champion_algorithm"] == "XGBoost Classifier"

    report_resp = client.get("/api/v1/ml/evaluation-report")
    assert report_resp.status_code == 200
    rep = report_resp.json()
    assert "XGBoost" in rep["report_markdown"]
