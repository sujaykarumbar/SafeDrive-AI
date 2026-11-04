# SafeDrive AI — Machine Learning Pipeline & Training Workspace

This workspace contains the data preprocessing, model training, evaluation, and serialization scripts for SafeDrive AI.

## Planned Phase 2 Modules

### 1. Road-Hazard Computer Vision Classifier
- **Target Classes**: `pothole`, `crack` (road surface damage), `fallen_tree`, `waterlogging`, `other/normal`
- **Data Source**: RDD2022 (Road Damage Dataset 2022) augmented with verified municipal road-hazard photography
- **Model Architecture**: Transfer learning with MobileNetV3-Small / EfficientNet-B0 for real-time inference latency
- **Outputs**: Predicted hazard class, confidence score [0.0 - 1.0], and cautious severity rating (Low, Medium, High, Critical)

### 2. Driving-Risk Prediction Engine
- **Features Extracted**:
  - `speed_mean_kmh`, `speed_max_kmh`, `speed_std_kmh`
  - `harsh_brake_count_per_10km`, `harsh_accel_count_per_10km`, `sharp_turn_count`
  - `night_driving_ratio` (11 PM - 5 AM)
  - `fatigue_warning_count` (continuous driving duration > 2h without rest)
  - `vehicle_category_factor` (Bike, Scooter, Car, Taxi, Truck, Bus)
- **Model Architectures**: Baseline Logistic Regression vs. Random Forest vs. XGBoost
- **Explainability**: SHAP (SHapley Additive exPlanations) values explaining risk factors to caretakers
- **Output**: 0–100 driving risk index

### 3. Execution Scripts (Phase 2)
- `train_hazard_classifier.py`
- `train_risk_model.py`
- `evaluate_models.py`
