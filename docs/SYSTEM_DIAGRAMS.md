# SafeDrive AI — System Diagrams & Architectural Blueprints

*Corresponding to the Final-Year Major Project Report & Master Blueprint.*

---

## 1. Use-Case Diagram (Blueprint Figure 1.3)

```mermaid
flowchart LR
    subgraph Actors
        D((Driver))
        C((Caretaker))
        O((Road Dept Officer))
        A((System Admin))
    end

    subgraph SafeDrive AI Platform
        UC1([Navigate / Safe Route])
        UC2([Receive Zone Alerts])
        UC3([Report Road Issue / Photo])
        UC4([Vote on Hazard Still There/Fixed])
        UC5([Monitored for Drowsiness / EAR])
        UC6([Trigger SOS / Auto Crash])
        UC7([View Live Fleet Location])
        UC8([View Risk Dashboard & SHAP])
        UC9([Replay Past Trips])
        UC10([Acknowledge Emergency])
        UC11([Set Geofence / Curfew])
        UC12([Manage Queue & Assign Team])
        UC13([Upload After-Photo & Fix Hazard])
        UC14([System Audit Logs & Models])
    end

    D --> UC1
    D --> UC2
    D --> UC3
    D --> UC4
    D --> UC5
    D --> UC6

    C --> UC7
    C --> UC8
    C --> UC9
    C --> UC10
    C --> UC11

    O --> UC12
    O --> UC13

    A --> UC14
```

---

## 2. Master System Blueprint: Layered Architecture (Blueprint Figure 2.1)

```mermaid
flowchart TD
    subgraph Layer 1: Clients
        L1_Driver["Driver Mobile App (Flutter & Dart)\nGPS | Front Camera | Sensors | Audio Alerts"]
        L1_Caretaker["Caretaker Website (React + TypeScript)\nLive Fleet Map | Driver Risk | Replay"]
        L1_Officer["Road Dept Panel (React + Leaflet)\nIssue Queue | Verified Fix Evidence"]
    end

    subgraph Layer 2: On-Device Edge AI
        L2_Drowsiness["Drowsiness Engine (MediaPipe FaceMesh)\nEAR < 0.22 (1.5s) | MAR Yawn | Head Nodding"]
        L2_Crash["Crash Detection (Accelerometer Spike > 4.0g)\nSudden Speed Drop + 30s Countdown"]
        L2_Offline["Offline SQLite Queue & Sync Cache"]
    end

    subgraph Layer 3: API Gateway
        L3_Gateway["FastAPI Gateway (Python 3.11)\nJWT Auth | CORS | Rate-Limiter | Static Media"]
        L3_WS["WebSocket Server\nLive GPS Telemetry & Emergency Broadcasts"]
    end

    subgraph Layer 4: Backend Micro-Services
        L4_Route["Route Engine (Formula Chapter 4.1)\nw1*hazard + w2*zone + w3*traffic + w4*hotspot"]
        L4_Hazard["Hazard Service (CNN / Feature Classifier)\n5 Classes: Pothole, Crack, Tree, Water, Normal"]
        L4_Risk["Risk Engine (XGBoost 85.3% Acc, 0.962 ROC-AUC)\nSHAP Factor Decomposition"]
        L4_Zones["Zone Engine (Geofencing)\nSchool Hours, Hospital Zones, DBSCAN Hotspots"]
        L4_Escalate["Emergency Escalation\nLevel 1-4 Multi-Channel Escalation"]
        L4_Notifier["Notification Service\nPush | Twilio SMS/Voice | SendGrid Email"]
    end

    subgraph Layer 5: Data Stores
        L5_DB[("PostgreSQL / SQLite\nUsers, Trips, Locations, Hazards, Audits")]
        L5_Redis[("Redis Cache\nLive Geolocation State & Task Queue")]
        L5_Storage[("Object Storage\nHazard Photos & Verified Proof Images")]
    end

    L1_Driver --> L2_Drowsiness & L2_Crash & L2_Offline
    L2_Drowsiness & L2_Crash & L2_Offline --> L3_Gateway & L3_WS
    L1_Caretaker & L1_Officer --> L3_Gateway & L3_WS
    L3_Gateway --> L4_Route & L4_Hazard & L4_Risk & L4_Zones & L4_Escalate
    L4_Route & L4_Hazard & L4_Risk & L4_Zones & L4_Escalate --> L5_DB & L5_Redis & L5_Storage
```

---

## 3. End-to-End Road Hazard Lifecycle (Blueprint Figure 5.1 & 5.4)

```mermaid
sequenceDiagram
    autonumber
    actor Driver as Driver Mobile App
    participant API as FastAPI Gateway
    participant CNN as Hazard Classifier (CNN)
    participant DB as PostGIS / SQLite
    actor Officer as Road Dept Officer
    actor Caretaker as Monitored Caretaker

    Driver->>API: POST /hazards/ (Photo + GPS Coordinates)
    API->>CNN: Classify Image Bytes
    CNN-->>API: Label: 'pothole', Confidence: 0.94, Severity: 'high'
    API->>DB: Check Duplicate (< 30m) & Save Hazard
    API-->>Driver: 201 Created (Hazard #10 Logged)
    API->>Officer: Multi-Channel Alert (Push + SMS + Email)
    Officer->>API: PATCH /hazards/10/status ('in_progress')
    Officer->>API: PATCH /hazards/10/status ('fixed' + after_photo proof)
    API->>DB: Record Status History & Verified Fix
    API-->>Driver: Push Notification: "Hazard Repaired by Road Taskforce!"
```

---

## 4. Emergency Escalation Flowchart (Blueprint Figure 7.1)

```mermaid
flowchart TD
    E1["Impact Spike (>4.0g) OR Manual SOS Pressed"] --> E2{"'Are You OK?' Screen\n30s Countdown + Alarm + Vibrate"}
    E2 -- Driver taps OK --> E3["Incident Cancelled\nFalse Alarm Logged"]
    E2 -- No response after 30s --> E4["Level 2 Instant Dispatch\nPush + SMS + Email + Live Map Link to Caretakers"]
    E4 --> E5["Level 3 Sequential Automated Call\nCaretaker 1 -> Caretaker 2 -> Caretaker 3"]
    E5 -- Caretaker Acknowledges --> E6["Incident Acknowledged\nTimeline Recorded"]
    E5 -- Timeout (2-3 min unacknowledged) --> E7["Level 4 Ambulance Dispatch\nSimulated 108/Emergency Dispatch with Blood Group & Medical Notes"]
    E7 --> E8["Closed-Loop Incident Record in Admin/Caretaker Center"]
```

---

## 5. Complete Database Entity Relationship (ER) Diagram (Blueprint Figure 11.1)

```mermaid
erDiagram
    USERS ||--o{ DRIVER_PROFILES : has
    USERS ||--o{ VEHICLES : owns
    USERS ||--o{ TRIPS : drives
    USERS ||--o{ CARETAKER_LINKS : authorizes
    USERS ||--o{ HAZARDS : reports
    USERS ||--o{ EMERGENCY_INCIDENTS : triggers
    USERS ||--o{ AUDIT_LOGS : performs

    VEHICLES ||--o{ TRIPS : assigned_to
    VEHICLES }o--|| VEHICLE_PROFILES : configures

    TRIPS ||--o{ TRIP_LOCATIONS : contains
    TRIPS ||--o{ DRIVING_EVENTS : generates
    TRIPS ||--o{ EMERGENCY_INCIDENTS : associates

    HAZARDS ||--o{ HAZARD_STATUS_HISTORY : tracks
    HAZARDS ||--o{ HAZARD_CONFIRMATIONS : receives

    USERS {
        int id PK
        string email UK
        string name
        string role
        string phone
        string hashed_password
        datetime created_at
    }

    DRIVER_PROFILES {
        int id PK
        int user_id FK
        string license_number
        string blood_group
        text medical_notes
        float current_safety_score
    }

    VEHICLES {
        int id PK
        int driver_id FK
        string category
        string make
        string model
        string registration_label
        boolean is_default
    }

    TRIPS {
        int id PK
        int driver_id FK
        int vehicle_id FK
        string status
        datetime start_time
        datetime end_time
        float distance_km
        float duration_minutes
        float risk_score
        string risk_level
        json risk_factors
    }

    TRIP_LOCATIONS {
        int id PK
        int trip_id FK
        float latitude
        float longitude
        float speed_kmh
        float heading
        float battery_level
        datetime timestamp
    }

    DRIVING_EVENTS {
        int id PK
        int trip_id FK
        string event_type
        string severity
        float confidence
        json metadata_json
        datetime timestamp
    }

    HAZARDS {
        int id PK
        int reporter_id FK
        string hazard_type
        string severity
        string status
        string title
        float latitude
        float longitude
        string image_url
        string fixed_image_url
        int confirmation_count
    }

    EMERGENCY_INCIDENTS {
        int id PK
        int driver_id FK
        int trip_id FK
        string incident_type
        string status
        int escalation_level
        json medical_snapshot
        datetime created_at
    }
```
