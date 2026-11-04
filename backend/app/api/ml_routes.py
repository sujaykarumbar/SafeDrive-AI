import os
import json
import base64
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.api.deps import get_current_user
from backend.app.models.user import User
from backend.app.models.model_version import ModelVersion
from backend.app.ml.hazard_service import hazard_service
from backend.app.ml.risk_service import risk_service, FEATURE_COLS

router = APIRouter(prefix="/ml", tags=["Machine Learning"])

ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml", "artifacts")
REPORT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "ml_training", "evaluation_report.md"))


class FeatureRiskRequest(BaseModel):
    distance_km: float = Field(..., example=8.5)
    duration_minutes: float = Field(..., example=22.0)
    speed_mean_kmh: float = Field(..., example=42.0)
    speed_max_kmh: float = Field(..., example=68.0)
    speed_std_kmh: float = Field(..., example=11.2)
    harsh_brake_count: int = Field(..., example=2)
    harsh_accel_count: int = Field(..., example=1)
    sharp_turn_count: int = Field(..., example=1)
    night_driving_ratio: float = Field(..., example=0.35)
    fatigue_warning_count: int = Field(..., example=0)
    vehicle_category: Optional[str] = Field("car", example="car")


class Base64ImageRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded JPG or PNG image")
    filename: Optional[str] = "hazard.jpg"


@router.post("/classify-hazard")
async def classify_hazard_image(
    file: Optional[UploadFile] = File(None),
    payload: Optional[Base64ImageRequest] = None
):
    """
    Classifies a road hazard photo into:
    - pothole, crack, waterlogging, fallen_tree, normal_road
    Returns confidence, cautious severity mapping, and uncertainty flag (<0.60 threshold).
    """
    if file is not None:
        image_bytes = await file.read()
    elif payload is not None and payload.image_base64:
        raw_b64 = payload.image_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        try:
            image_bytes = base64.b64decode(raw_b64)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 encoding")
    else:
        raise HTTPException(
            status_code=400,
            detail="Must provide an image either via multipart 'file' or JSON 'image_base64'"
        )

    try:
        result = hazard_service.classify_image_bytes(image_bytes)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")


@router.post("/predict-trip-risk/{trip_id}")
def predict_trip_risk(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Evaluates driving risk for a specific trip using telemetry and events.
    Computes continuous 0-100 score, categorical risk level, and SHAP-aligned explanations.
    Updates the trip in the database and returns the result.
    """
    try:
        evaluation = risk_service.evaluate_and_update_trip(db, trip_id)
        return evaluation
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")


@router.post("/predict-features-risk")
def predict_features_risk(payload: FeatureRiskRequest):
    """
    Direct model evaluation from a raw feature dictionary.
    Used for simulation stations, what-if analyses, and unit testing.
    """
    features = payload.model_dump()
    vehicle_cat = features.get("vehicle_category", "car").lower()
    from backend.app.ml.risk_service import VEHICLE_MAP
    features["vehicle_category_code"] = VEHICLE_MAP.get(vehicle_cat, 2)

    result = risk_service.predict_risk(features)
    return {
        "features": features,
        "prediction": result
    }


@router.get("/models")
def get_model_registry(db: Session = Depends(get_db)):
    """
    Returns registered models, champion algorithms, versioning, and test evaluation metrics.
    """
    risk_meta_path = os.path.join(ARTIFACTS_DIR, "risk_metadata.json")
    hazard_meta_path = os.path.join(ARTIFACTS_DIR, "hazard_metadata.json")

    risk_meta = {}
    hazard_meta = {}

    if os.path.exists(risk_meta_path):
        with open(risk_meta_path, "r") as f:
            risk_meta = json.load(f)

    if os.path.exists(hazard_meta_path):
        with open(hazard_meta_path, "r") as f:
            hazard_meta = json.load(f)

    # Also query DB registered models if any
    db_models = db.query(ModelVersion).filter(ModelVersion.is_active == True).all()

    return {
        "hazard_classifier": {
            "name": hazard_meta.get("model_name", "SafeDrive Hazard CNN/Feature Classifier"),
            "version": hazard_meta.get("version", "1.0.0"),
            "classes": hazard_meta.get("classes", ["pothole", "crack", "waterlogging", "fallen_tree", "normal_road"]),
            "metrics": hazard_meta.get("metrics", {}),
            "uncertainty_threshold": hazard_meta.get("uncertainty_threshold", 0.60),
            "status": "active"
        },
        "risk_predictor": {
            "name": risk_meta.get("model_name", "SafeDrive Driving Risk Prediction Engine"),
            "version": risk_meta.get("version", "1.0.0"),
            "champion_algorithm": risk_meta.get("champion_algorithm", "XGBoost Classifier"),
            "feature_importances": risk_meta.get("feature_importances", {}),
            "comparative_evaluation": risk_meta.get("comparative_evaluation", []),
            "risk_index_thresholds": risk_meta.get("risk_index_transformation", {}).get("thresholds", {}),
            "status": "active"
        },
        "registered_versions_count": len(db_models)
    }


@router.get("/evaluation-report")
def get_evaluation_report():
    """
    Returns the formal Markdown academic evaluation report comparing Logistic Regression,
    Random Forest, and XGBoost models.
    """
    if os.path.exists(REPORT_PATH):
        with open(REPORT_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        return {"report_markdown": content}
    return {"report_markdown": "Report not found."}
