# SafeDrive AI — Database Schema Specification

The schema is built on SQLAlchemy and supports both **PostgreSQL + PostGIS** for production deployments and **SQLite** for zero-dependency local development and testing.

## Entity Relationship Overview

```
users (PK: id)
  ├── 1:1  driver_profiles (FK: user_id)
  ├── 1:N  vehicles (FK: driver_id)
  ├── 1:N  trips (FK: driver_id)
  ├── 1:N  hazards (FK: reporter_id)
  ├── 1:N  caretaker_links (FK: driver_id, caretaker_id)
  └── 1:N  audit_logs (FK: user_id)

trips (PK: id)
  ├── 1:N  trip_locations (FK: trip_id)
  ├── 1:N  driving_events (FK: trip_id)
  └── 1:N  emergency_incidents (FK: trip_id)

hazards (PK: id)
  ├── 1:N  hazard_status_history (FK: hazard_id)
  └── 1:N  hazard_confirmations (FK: hazard_id)
```

---

## Detailed Table Definitions

### 1. `users`
- `id` (INTEGER, PK, Autoincrement)
- `email` (VARCHAR(255), UNIQUE, NOT NULL, INDEX)
- `phone` (VARCHAR(50), NULL, INDEX)
- `name` (VARCHAR(100), NOT NULL)
- `hashed_password` (VARCHAR(255), NOT NULL)
- `role` (VARCHAR(20), DEFAULT 'driver', NOT NULL) — Enum: `driver`, `caretaker`, `officer`, `admin`
- `is_active` (BOOLEAN, DEFAULT TRUE)
- `created_at` (TIMESTAMP, NOT NULL)

### 2. `driver_profiles`
- `id` (INTEGER, PK)
- `user_id` (INTEGER, FK -> `users.id` ON DELETE CASCADE, UNIQUE)
- `license_number` (VARCHAR(50), NULL)
- `blood_group` (VARCHAR(10), NULL)
- `medical_notes` (TEXT, NULL)
- `emergency_contact_name` (VARCHAR(100), NULL)
- `emergency_contact_phone` (VARCHAR(50), NULL)
- `current_safety_score` (FLOAT, DEFAULT 95.0)
- `total_distance_km` (FLOAT, DEFAULT 0.0)
- `total_trips` (INTEGER, DEFAULT 0)
- `created_at` (TIMESTAMP)

### 3. `caretaker_links`
- `id` (INTEGER, PK)
- `driver_id` (INTEGER, FK -> `users.id`, INDEX)
- `caretaker_id` (INTEGER, FK -> `users.id`, INDEX)
- `status` (VARCHAR(20), DEFAULT 'accepted') — Enum: `pending`, `accepted`, `revoked`
- `invite_code` (VARCHAR(20), NULL, INDEX)
- `consent_granted` (BOOLEAN, DEFAULT TRUE)
- `can_view_live` (BOOLEAN, DEFAULT TRUE)
- `created_at` (TIMESTAMP)

### 4. `vehicles`
- `id` (INTEGER, PK)
- `driver_id` (INTEGER, FK -> `users.id`, INDEX)
- `category` (VARCHAR(30), DEFAULT 'car') — Enum: `bike`, `scooter`, `car`, `taxi`, `truck`, `bus`
- `make` (VARCHAR(50), NOT NULL)
- `model` (VARCHAR(50), NOT NULL)
- `registration_label` (VARCHAR(30), NOT NULL)
- `subtype` (VARCHAR(50), NULL)
- `is_default` (BOOLEAN, DEFAULT TRUE)
- `created_at` (TIMESTAMP)

### 5. `vehicle_profiles`
- `id` (INTEGER, PK)
- `category` (VARCHAR(30), UNIQUE, INDEX)
- `version` (VARCHAR(20), DEFAULT '1.0.0')
- `threshold_config` (JSON, NOT NULL) — Deceleration limits, acceleration limits, yaw rates, rest intervals
- `description` (TEXT, NULL)
- `effective_from` (TIMESTAMP)

### 6. `trips`
- `id` (INTEGER, PK)
- `driver_id` (INTEGER, FK -> `users.id`, INDEX)
- `vehicle_id` (INTEGER, FK -> `vehicles.id`, NULL, INDEX)
- `status` (VARCHAR(20), DEFAULT 'active', INDEX) — Enum: `active`, `completed`, `cancelled`
- `start_time` (TIMESTAMP, NOT NULL)
- `end_time` (TIMESTAMP, NULL)
- `start_lat`, `start_lng` (FLOAT, NULL)
- `end_lat`, `end_lng` (FLOAT, NULL)
- `start_address`, `end_address` (VARCHAR(255), NULL)
- `distance_km` (FLOAT, DEFAULT 0.0)
- `duration_minutes` (FLOAT, DEFAULT 0.0)
- `avg_speed_kmh`, `max_speed_kmh` (FLOAT, DEFAULT 0.0)
- `risk_score` (FLOAT, DEFAULT 15.0) — 0 (safest) to 100 (critical risk)
- `risk_level` (VARCHAR(20), DEFAULT 'low')
- `risk_factors` (JSON, DEFAULT '[]')
- `summary_notes` (TEXT, NULL)

### 7. `trip_locations`
- `id` (INTEGER, PK)
- `trip_id` (INTEGER, FK -> `trips.id` ON DELETE CASCADE, INDEX)
- `latitude` (FLOAT, NOT NULL)
- `longitude` (FLOAT, NOT NULL)
- `speed_kmh` (FLOAT, DEFAULT 0.0)
- `heading` (FLOAT, DEFAULT 0.0)
- `accuracy_m` (FLOAT, DEFAULT 5.0)
- `battery_level` (FLOAT, DEFAULT 100.0)
- `is_moving` (BOOLEAN, DEFAULT TRUE)
- `timestamp` (TIMESTAMP, INDEX)

### 8. `driving_events`
- `id` (INTEGER, PK)
- `trip_id` (INTEGER, FK -> `trips.id`, INDEX)
- `vehicle_id` (INTEGER, FK -> `vehicles.id`, NULL)
- `event_type` (VARCHAR(50), NOT NULL, INDEX) — e.g. `harsh_brake`, `overspeed`, `sharp_turn`
- `severity` (VARCHAR(20), DEFAULT 'low')
- `latitude`, `longitude` (FLOAT, NULL)
- `confidence` (FLOAT, DEFAULT 0.90)
- `metadata_json` (JSON)
- `timestamp` (TIMESTAMP)

### 9. `hazards`
- `id` (INTEGER, PK)
- `reporter_id` (INTEGER, FK -> `users.id`, NULL, INDEX)
- `hazard_type` (VARCHAR(50), NOT NULL, INDEX) — `pothole`, `crack`, `waterlogging`, `fallen_tree`, `accident`, `other`
- `severity` (VARCHAR(20), DEFAULT 'medium', INDEX) — `low`, `medium`, `high`, `critical`
- `status` (VARCHAR(30), DEFAULT 'reported', INDEX) — `reported`, `forwarded`, `assigned`, `in_progress`, `fixed`, `expired`
- `title` (VARCHAR(150), NOT NULL)
- `description` (TEXT, NULL)
- `latitude`, `longitude` (FLOAT, NOT NULL, INDEX)
- `address` (VARCHAR(255), NULL)
- `image_url`, `fixed_image_url` (VARCHAR(500), NULL)
- `assigned_department` (VARCHAR(100))
- `assigned_officer_id` (INTEGER, FK -> `users.id`, NULL)
- `confirmation_count` (INTEGER, DEFAULT 1)
- `confidence` (FLOAT, DEFAULT 0.92)
- `created_at`, `updated_at` (TIMESTAMP)

### 10. `hazard_status_history`
- `id` (INTEGER, PK)
- `hazard_id` (INTEGER, FK -> `hazards.id` ON DELETE CASCADE, INDEX)
- `previous_status` (VARCHAR(30), NULL)
- `new_status` (VARCHAR(30), NOT NULL)
- `changed_by_user_id` (INTEGER, FK -> `users.id`, NULL)
- `notes` (TEXT, NULL)
- `proof_image_url` (VARCHAR(500), NULL)
- `timestamp` (TIMESTAMP)

### 11. `emergency_incidents`
- `id` (INTEGER, PK)
- `trip_id` (INTEGER, FK -> `trips.id`, NULL, INDEX)
- `driver_id` (INTEGER, FK -> `users.id`, NOT NULL, INDEX)
- `incident_type` (VARCHAR(50), DEFAULT 'manual_sos') — `manual_sos`, `crash_detected`
- `status` (VARCHAR(30), DEFAULT 'triggered', INDEX) — `triggered`, `cancelled`, `alerted`, `acknowledged`, `resolved`
- `latitude`, `longitude` (FLOAT, NOT NULL)
- `location_address` (VARCHAR(255), NULL)
- `countdown_cancelled` (BOOLEAN, DEFAULT FALSE)
- `acknowledged_by_user_id` (INTEGER, FK -> `users.id`, NULL)
- `acknowledged_at` (TIMESTAMP, NULL)
- `escalation_level` (INTEGER, DEFAULT 1)
- `medical_snapshot` (JSON)
- `notes` (TEXT, NULL)
- `created_at` (TIMESTAMP)

### 12. `audit_logs`
- `id` (INTEGER, PK)
- `user_id` (INTEGER, FK -> `users.id`, NULL, INDEX)
- `action` (VARCHAR(100), NOT NULL)
- `resource_type` (VARCHAR(50), NULL)
- `resource_id` (VARCHAR(50), NULL)
- `details_json` (JSON)
- `ip_address` (VARCHAR(45), NULL)
- `timestamp` (TIMESTAMP, INDEX)
