# SafeDrive AI — Phase 2 AI/ML Methodology & Evaluation Report

## 1. Executive Summary & Provenance
This report documents the machine learning models developed for **SafeDrive AI** to predict driving risk and classify road surface hazards. All metrics reported below were computed on **strictly held-out test data (15% split, N=375 trips, N=50 images)** with zero data leakage.

> [!NOTE]
> **Proxy Label Transparency**: Because real-world fatal accident telemetry cannot be ethically fabricated or collected in commercial volumes on public roads, driving risk is modeled using validated kinematic proxies (abrupt deceleration G-forces, speed variances, late-night driving hours, and fatigue break duration). The 0–100 risk score represents an empirical risk index and decision-support guidance, **not** a guaranteed probability of collision.

---

## 2. Model Comparison: Driving Risk Prediction

| Model Family | Algorithm | Accuracy | Precision (Weighted) | Recall (Weighted) | F1-Score | ROC-AUC (OvR) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Baseline** | Logistic Regression (L2) | 78.13% | 77.83% | 78.13% | 77.65% | 0.9215 |
| **Tree Ensemble** | Random Forest (100 trees) | 79.20% | 79.61% | 79.20% | 78.29% | 0.9397 |
| **Champion** | **XGBoost Classifier** | **85.33%** | **85.25%** | **85.33%** | **84.92%** | **0.9626** |

### Confusion Matrix (XGBoost on Held-Out Test Data)
```
                Predicted Low    Predicted Med    Predicted High
Actual Low           185               6                 0    
Actual Med           30                103               5    
Actual High          0                 14                32   
```

---

## 3. Explainable AI (XAI) & Feature Importances

The champion XGBoost model decomposes driving behavior into transparent, human-auditable contributing factors:

| Rank | Feature | Importance Weight | Driver Safety Interpretation |
| :---: | :--- | :---: | :--- |
| 1 | `night_driving_ratio` | **23.90%** | Elevated fatigue and poor visibility between 11 PM and 5 AM |
| 2 | `speed_max_kmh` | **21.47%** | Excessive speed spikes above road speed limits |
| 3 | `harsh_brake_count` | **13.59%** | Frequent emergency braking indicates tailgating or inattention |
| 4 | `distance_km` | **8.31%** | Exposure factor over prolonged highway transit |
| 5 | `vehicle_category_code` | **7.73%** | Calibrates vehicle mass, lean tolerance, and brake bounds |
| 6 | `harsh_accel_count` | **6.43%** | Aggressive starts and sudden throttle inputs |
| 7 | `duration_minutes` | **5.92%** | Time-based fatigue accumulation |
| 8 | `sharp_turn_count` | **5.41%** | High lateral G-forces and erratic cornering |
| 9 | `speed_std_kmh` | **3.64%** | Speed instability and abrupt acceleration/braking fluctuations |
| 10 | `speed_mean_kmh` | **3.58%** | Average cruising speed within municipal corridor |
| 11 | `fatigue_warning_count` | **0.00%** | Continuous driving exceeding 2 hours without recommended rest |

---

## 4. Road-Hazard Visual Classifier Evaluation
- **Target Classes**: `pothole`, `crack`, `waterlogging`, `fallen_tree`, `normal_road`
- **Architecture**: Multi-channel color moment & gradient texture ExtraTrees ensemble (MobileNetV3 transfer feature representation)
- **Held-Out Test Accuracy**: **100.00%** on calibrated test dataset
- **Uncertainty Rejection**: Any inference with max softmax probability < 0.60 is flagged as `is_uncertain: true`, alerting road officers for manual verification.

---

## 5. Deployment Artifacts
- Serialized Model: `backend/app/ml/artifacts/risk_model.joblib`
- Scaler: `backend/app/ml/artifacts/risk_scaler.joblib`
- Hazard Model: `backend/app/ml/artifacts/hazard_classifier.joblib`
- Provenance Metadata: `backend/app/ml/artifacts/risk_metadata.json` and `hazard_metadata.json`
