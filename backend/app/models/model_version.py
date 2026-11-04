from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from backend.app.db.session import Base


class ModelVersion(Base):
    """
    Tracks deployed AI/ML model versions, training metrics, and serialization paths.
    Enables reproducible model provenance and transparent evaluation auditing.
    """
    __tablename__ = "model_versions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, index=True)  # 'hazard_classifier' or 'risk_predictor'
    version = Column(String(20), default="1.0.0", nullable=False)
    model_type = Column(String(50), nullable=False)        # e.g., 'RandomForestClassifier', 'XGBoost', 'CNN-FeatureClassifier'
    metrics_json = Column(JSON, default=dict)              # accuracy, precision, recall, f1, roc_auc, confusion_matrix
    hyperparameters = Column(JSON, default=dict)
    artifact_path = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
