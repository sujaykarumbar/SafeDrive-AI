# SafeDrive AI — Smart Driver Safety, Risk Prediction & Road Hazard Intelligence System

> **Final-Year Major Project | B.E. Artificial Intelligence & Machine Learning**  
> *"Safer Drivers | Smarter Routes | Safer Roads"*

SafeDrive AI is a complete, connected end-to-end intelligent road safety platform designed to predict driver risk, identify and repair road surface hazards, calculate multi-criteria safe routes, and automate multi-tiered emergency response.

---

## 🌟 Key Highlights & Implementation Summary

- **Multi-Vehicle Support (Addendum Compliant)**: Calibrated thresholds for **Bikes, Scooters, Cars, Taxis, Trucks, and Buses** with vehicle-specific G-force and road restrictions.
- **Machine Learning Driver Risk Engine**: Champion **XGBoost Classifier** achieving **85.33% Accuracy** and **0.9626 Multi-Class ROC-AUC** with SHAP-aligned explainability factor decomposition.
- **Computer Vision Hazard Classifier**: RDD2022-aligned 5-class model (`pothole`, `crack`, `waterlogging`, `fallen_tree`, `normal_road`) with uncertainty thresholding ($<0.60$) and duplicate merging ($<30\text{m}$).
- **Multi-Criteria Safe Route Scoring**:
  $$\text{route\_cost} = \text{distance\_time} + w_1 \cdot \text{hazard} + w_2 \cdot \text{zone} + w_3 \cdot \text{traffic} + w_4 \cdot \text{hotspot} + w_5 \cdot \text{night\_weather}$$
  Produces 3 evaluated routes: **Safest (Recommended)**, **Fastest**, and **Least Traffic**.
- **Geofenced School & Hospital Zones**: Proximity detection with speech guidance (*"School zone ahead, slow down to 25 km/h"*) and rate-limiting.
- **Multi-Step Emergency Escalation**: 30-second cancellation window for false alarms, automated multi-channel Caretaker alerts (Push, SMS, Email), sequential voice calling, and simulated 108/112 ambulance partner dispatch.
- **Full-Stack Implementation**:
  - **Backend**: Python 3.11, FastAPI, SQLAlchemy, WebSockets, SQLite/PostgreSQL.
  - **Web Dashboards**: React 18, TypeScript, Vite, Leaflet OpenStreetMap, Dark-mode Glassmorphism.
  - **Mobile App**: Flutter & Dart, Provider architecture, 9 complete screens.
  - **35/35 Automated Tests**: 100% test pass rate across all 5 project phases.

---

## 📂 Repository Structure

```
SafeDrive AI/
├── backend/                  # FastAPI REST Gateway & WebSocket Server
│   ├── app/
│   │   ├── api/              # Auth, Trips, Hazards, Routes, Emergency, Caretaker, ML
│   │   ├── core/             # JWT Security, Bcrypt, Settings
│   │   ├── db/               # SQLAlchemy Session, Seed Script
│   │   ├── ml/               # Hazard Classifier, XGBoost Risk Engine, Serialized Artifacts
│   │   ├── models/           # Users, Vehicles, Trips, Hazards, Emergency, Audits
│   │   ├── schemas/          # Pydantic v2 validation models
│   │   ├── services/         # Route Engine, Zone Service, Traffic Service, Escalation
│   │   └── websocket/        # Real-time Telemetry Broadcaster
├── datasets/                 # Calibrated Training Datasets
│   ├── rdd2022_sample/       # 300 Road Hazard Images across 5 classes
│   └── trips/                # 2,500 Multi-Vehicle Trip Telemetry Samples
├── docs/                     # Academic Deliverables
│   ├── SYSTEM_DIAGRAMS.md    # Mermaid Diagrams (Architecture, ER, Flowcharts, Use-Cases)
│   ├── VIVA_QA_AND_EVALUATION.md # Comprehensive Final-Year Defense Questions & Answers
│   ├── DATABASE_SCHEMA.md    # Relational Database Schema Documentation
│   └── API_DOCUMENTATION.md  # Interactive OpenAPI/Swagger Endpoints Reference
├── ml_training/              # Training Pipelines & Evaluation
│   ├── generate_datasets.py  # Dataset Generator
│   ├── train_hazard_classifier.py # CNN / Feature Hazard Training
│   ├── train_risk_model.py   # Baseline LogReg vs Random Forest vs XGBoost
│   └── evaluation_report.md  # Formal Academic Model Evaluation Report
├── mobile_app/               # Flutter Driver Mobile Application
│   └── lib/screens/          # Map, Drive, Reports, SOS, Insights, Vehicle Setup
├── tests/                    # Automated Verification Test Suite (35 Tests)
│   ├── test_phase1.py        # Core Foundation & Auth (9 tests)
│   ├── test_phase2.py        # ML Artifacts & Inference (8 tests)
│   ├── test_phase3.py        # Safe Route Scoring & Geofencing (9 tests)
│   ├── test_phase4.py        # Emergency Escalation & Road Dept (6 tests)
│   └── test_phase5.py        # End-to-End 6-Step Demo & Security Audit (3 tests)
└── web/                      # React + TypeScript Web Dashboards
    └── src/components/       # Caretaker Fleet, Road Dept Panel, Admin Console, Simulator
```

---

## 🚀 Quickstart & Execution Guide

### 1. Backend API Gateway & Database
```powershell
# Activate Python Virtual Environment
.\.venv\Scripts\activate

# Initialize Database Schema & Seed Demonstration Data
python -m backend.app.db.seed

# Launch FastAPI Dev Server on Port 8000
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
*API Documentation & Swagger UI available at:* `http://localhost:8000/docs`

---

### 2. Web Portals & Dashboards

You can run the dedicated web portals independently or via the root scripts:

#### A. Caretaker Fleet & Safety Portal (Port 5174)
Dedicated web portal for family caretakers and fleet managers to monitor live drivers, GPS paths, explainable risk factors, and acknowledge emergency SOS alerts:
```powershell
cd web-caretaker
npm install
npm run dev
```
*Portal available at:* `http://localhost:5174`

#### B. Road Department & Hazard Triage Portal (Port 5175)
Dedicated web portal for Municipal Corporation and Road Maintenance Officers to triage reported potholes/cracks/trees, inspect hazards on an interactive GIS map, assign field crews, and upload photo-verified repair proofs:
```powershell
cd web-road-department
npm install
npm run dev
```
*Portal available at:* `http://localhost:5175`

#### C. Root Launcher (Convenience Scripts)
From the project root directory (`SafeDrive AI/`):
```powershell
# Run Caretaker Portal
npm run dev:caretaker

# Run Road Department Portal
npm run dev:road-dept

# Run Unified Multi-Dashboard
npm run dev
```
*Unified dashboard available at:* `http://localhost:5173`

#### Seed Demonstration Credentials:
| Role | Email | Password |
| :--- | :--- | :--- |
| **Driver** | `rahul.driver@safedrive.ai` | `SafeDrive@2026` |
| **Caretaker** | `priya.caretaker@safedrive.ai` | `SafeDrive@2026` |
| **Road Officer** | `officer.kumar@safedrive.ai` | `SafeDrive@2026` |
| **Admin** | `admin.sys@safedrive.ai` | `SafeDrive@2026` |

---

### 3. Flutter Driver Mobile App
```powershell
cd mobile_app
flutter pub get
flutter run -d chrome    # Or flutter run -d <emulator-id>
```

---

### 4. Running the Complete Automated Test Suite (35/35 Passing)
```powershell
.\.venv\Scripts\pytest tests\ -v
```

---

## 🎬 6-Step Demonstration Script (Blueprint Chapter 13.4)

You can run through all 6 evaluation scenarios directly via the **Driver Mobile Simulation Station** on the web dashboard (`http://localhost:5173`):

1. **Step 1: Start Trip** — Click **"1. Start Simulated Trip"**. The simulated vehicle moves along the MG Road $\to$ Indiranagar $\to$ Koramangala corridor. The Caretaker dashboard tracks live speed, battery, and route polyline in real time.
2. **Step 2: Drowsiness Detection** — Click **"2. Simulate Drowsiness (EAR < 0.22)"**. MediaPipe eye closure is registered; the app sounds an alarm, updates the safety status to `warning`, and logs explainable risk factors.
3. **Step 3: School Zone Warning** — Click **"3. Enter School Zone"**. Geofencing detects National Public School Indiranagar; the app speaks: *"School zone ahead, slow down to 25 km/h."*
4. **Step 4: AI Hazard Reporting** — Click **"4. Report Pothole with AI"**. The photo is classified with 94% confidence; the hazard is forwarded immediately to the Road Department queue.
5. **Step 5: Road Dept Fix Verification** — In the Officer panel, click **"Mark Fixed"** and submit the after-photo repair proof. The reporting driver receives a push notification confirming the resolution.
6. **Step 6: Crash & SOS Escalation** — Click **"6. Trigger Crash (4.6g Spike)"**. The 30-second countdown begins; upon timeout, Level 2 multi-channel Caretaker alerts (Push, SMS, Email) and Level 4 Ambulance Partner dispatch are logged.
