"""
SafeDrive AI — Demonstration Seed Data Loader.
Populates initial reviewed vehicle profiles, demo users across all roles,
linked caretaker consent for fleet drivers, active and historical trips with telemetry,
driving events for 7-day analytics, open emergencies, and sample road hazards.
"""

from datetime import datetime, timezone, timedelta
from backend.app.db.session import SessionLocal, Base, engine
from backend.app.core.security import get_password_hash
from backend.app.models.user import User, DriverProfile, CaretakerLink, UserRole, LinkStatus
from backend.app.models.vehicle import Vehicle, VehicleProfile, VehicleCategory
from backend.app.models.trip import Trip, TripLocation, DrivingEvent, TripStatus, RiskLevel
from backend.app.models.hazard import Hazard, HazardStatusHistory, HazardStatus, HazardSeverity, HazardType
from backend.app.models.emergency import EmergencyIncident, IncidentStatus, IncidentType
from backend.app.models.model_version import ModelVersion
from backend.app.api.vehicles import DEFAULT_THRESHOLDS


def init_and_seed_db():
    print("[SafeDrive AI] Creating database schema tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Seed Vehicle Profiles
        print("[SafeDrive AI] Seeding Vehicle Profiles...")
        for cat, config in DEFAULT_THRESHOLDS.items():
            existing_prof = db.query(VehicleProfile).filter(VehicleProfile.category == cat).first()
            if not existing_prof:
                prof = VehicleProfile(
                    category=cat,
                    version="1.0.0",
                    threshold_config=config,
                    description=config.get("notes", f"Reviewed profile for {cat}")
                )
                db.add(prof)
        db.commit()

        default_pwd = get_password_hash("SafeDrive@2026")

        # 2. Seed Caretaker, Officer, and Admin
        print("[SafeDrive AI] Seeding Core Users...")
        caretaker_user = db.query(User).filter(User.email == "priya.caretaker@safedrive.ai").first()
        if not caretaker_user:
            caretaker_user = User(
                email="priya.caretaker@safedrive.ai",
                name="Priya Sharma",
                phone="+919876543211",
                hashed_password=default_pwd,
                role=UserRole.CARETAKER.value,
                is_active=True
            )
            db.add(caretaker_user)
            db.flush()

        officer_user = db.query(User).filter(User.email == "officer.kumar@safedrive.ai").first()
        if not officer_user:
            officer_user = User(
                email="officer.kumar@safedrive.ai",
                name="Inspector Kumar (Road Dept)",
                phone="+919876543212",
                hashed_password=default_pwd,
                role=UserRole.OFFICER.value,
                is_active=True
            )
            db.add(officer_user)
            db.flush()

        admin_user = db.query(User).filter(User.email == "admin@safedrive.ai").first()
        if not admin_user:
            admin_user = User(
                email="admin@safedrive.ai",
                name="SafeDrive Administrator",
                phone="+919876543213",
                hashed_password=default_pwd,
                role=UserRole.ADMIN.value,
                is_active=True
            )
            db.add(admin_user)
            db.flush()

        db.commit()

        # 3. Seed 5 Demonstration Fleet Drivers
        print("[SafeDrive AI] Seeding Demonstration Fleet Drivers...")
        demo_drivers = [
            {
                "name": "Rahul Kumar",
                "email": "rahul.driver@safedrive.ai",
                "phone": "+919876543210",
                "license": "KA-01-2022-009182",
                "blood": "O+",
                "score": 96.0,
                "dist": 342.8,
                "trips": 26,
                "vehicle": {"cat": "car", "make": "Hyundai", "model": "Creta SX", "reg": "KA 01 AB 1234"},
                "is_active_trip": True,
                "active_start": "MG Road, Bengaluru",
                "active_end": "Electronic City, Bengaluru",
                "lat": 12.9716,
                "lng": 77.5946,
                "speed": 62.0,
                "batt": 94.0
            },
            {
                "name": "Anjali Reddy",
                "email": "anjali.driver@safedrive.ai",
                "phone": "+919876543214",
                "license": "KA-01-2021-008123",
                "blood": "B+",
                "score": 88.0,
                "dist": 195.4,
                "trips": 18,
                "vehicle": {"cat": "bike", "make": "Royal Enfield", "model": "Classic 350", "reg": "KA 01 CD 5678"},
                "is_active_trip": False,
                "lat": 12.9784,
                "lng": 77.6408,
                "speed": 0.0,
                "batt": 89.0
            },
            {
                "name": "Vikram Singh",
                "email": "vikram.driver@safedrive.ai",
                "phone": "+919876543215",
                "license": "KA-01-2019-004512",
                "blood": "A+",
                "score": 93.0,
                "dist": 820.5,
                "trips": 42,
                "vehicle": {"cat": "truck", "make": "BharatBenz", "model": "2823C", "reg": "KA 01 EF 9012"},
                "is_active_trip": False,
                "lat": 13.0285,
                "lng": 77.5197,
                "speed": 0.0,
                "batt": 98.0
            },
            {
                "name": "Sneha Patel",
                "email": "sneha.driver@safedrive.ai",
                "phone": "+919876543216",
                "license": "KA-01-2020-006734",
                "blood": "AB+",
                "score": 70.0,
                "dist": 512.0,
                "trips": 34,
                "vehicle": {"cat": "bus", "make": "Ashok Leyland", "model": "Falcon", "reg": "KA 01 GH 3456"},
                "is_active_trip": True,
                "active_start": "Hebbal Flyover",
                "active_end": "Silk Board",
                "lat": 12.9352,
                "lng": 77.6245,
                "speed": 38.0,
                "batt": 76.0
            },
            {
                "name": "Arjun Nair",
                "email": "arjun.driver@safedrive.ai",
                "phone": "+919876543217",
                "license": "KA-01-2023-001298",
                "blood": "O-",
                "score": 90.0,
                "dist": 85.2,
                "trips": 12,
                "vehicle": {"cat": "bike", "make": "Ather", "model": "450X", "reg": "KA 01 IJ 7890"},
                "is_active_trip": False,
                "lat": 12.9279,
                "lng": 77.6271,
                "speed": 0.0,
                "batt": 91.0
            }
        ]

        seeded_driver_users = []

        for d_info in demo_drivers:
            d_user = db.query(User).filter(User.email == d_info["email"]).first()
            if not d_user:
                d_user = User(
                    email=d_info["email"],
                    name=d_info["name"],
                    phone=d_info["phone"],
                    hashed_password=default_pwd,
                    role=UserRole.DRIVER.value,
                    is_active=True
                )
                db.add(d_user)
                db.flush()

                profile = DriverProfile(
                    user_id=d_user.id,
                    license_number=d_info["license"],
                    blood_group=d_info["blood"],
                    medical_notes="All clear. No chronic allergies.",
                    emergency_contact_name="Priya Sharma (Caretaker)",
                    emergency_contact_phone=caretaker_user.phone,
                    current_safety_score=d_info["score"],
                    total_distance_km=d_info["dist"],
                    total_trips=d_info["trips"]
                )
                db.add(profile)

                v_info = d_info["vehicle"]
                veh = Vehicle(
                    driver_id=d_user.id,
                    category=v_info["cat"],
                    make=v_info["make"],
                    model=v_info["model"],
                    registration_label=v_info["reg"],
                    is_default=True
                )
                db.add(veh)
                db.flush()

                # Link with Caretaker
                link = CaretakerLink(
                    driver_id=d_user.id,
                    caretaker_id=caretaker_user.id,
                    status=LinkStatus.ACCEPTED.value,
                    invite_code=f"SD{d_user.id:04d}",
                    consent_granted=True,
                    can_view_live=True
                )
                db.add(link)

                # Active Trip if applicable
                if d_info.get("is_active_trip"):
                    now = datetime.now(timezone.utc)
                    active_trip = Trip(
                        driver_id=d_user.id,
                        vehicle_id=veh.id,
                        status=TripStatus.ACTIVE.value,
                        start_time=now - timedelta(minutes=24),
                        start_lat=d_info["lat"],
                        start_lng=d_info["lng"],
                        start_address=d_info.get("active_start", "MG Road"),
                        end_address=d_info.get("active_end", "Electronic City"),
                        distance_km=12.4,
                        duration_minutes=24.0,
                        avg_speed_kmh=d_info["speed"] * 0.7,
                        max_speed_kmh=d_info["speed"] * 1.2,
                        risk_score=round(100.0 - d_info["score"], 1),
                        risk_level=RiskLevel.LOW.value if d_info["score"] >= 80 else RiskLevel.MEDIUM.value,
                        risk_factors=["Normal corridor flow", "Safe headway maintained"]
                    )
                    db.add(active_trip)
                    db.flush()

                    loc = TripLocation(
                        trip_id=active_trip.id,
                        latitude=d_info["lat"],
                        longitude=d_info["lng"],
                        speed_kmh=d_info["speed"],
                        heading=145.0,
                        battery_level=d_info["batt"],
                        timestamp=now
                    )
                    db.add(loc)
                else:
                    # Completed trip for history
                    past_trip = Trip(
                        driver_id=d_user.id,
                        vehicle_id=veh.id,
                        status=TripStatus.COMPLETED.value,
                        start_time=datetime.now(timezone.utc) - timedelta(hours=5),
                        end_time=datetime.now(timezone.utc) - timedelta(hours=4, minutes=30),
                        start_lat=d_info["lat"] - 0.02,
                        start_lng=d_info["lng"] - 0.02,
                        end_lat=d_info["lat"],
                        end_lng=d_info["lng"],
                        start_address="Indiranagar 100ft Road",
                        end_address="MG Road Corridor",
                        distance_km=8.4,
                        duration_minutes=30.0,
                        avg_speed_kmh=32.0,
                        max_speed_kmh=52.0,
                        risk_score=15.0,
                        risk_level=RiskLevel.LOW.value,
                        risk_factors=["Attentive driving with steady deceleration"]
                    )
                    db.add(past_trip)
                    db.flush()

                    loc = TripLocation(
                        trip_id=past_trip.id,
                        latitude=d_info["lat"],
                        longitude=d_info["lng"],
                        speed_kmh=0.0,
                        heading=0.0,
                        battery_level=d_info["batt"],
                        timestamp=datetime.now(timezone.utc)
                    )
                    db.add(loc)

                seeded_driver_users.append(d_user)

        db.commit()

        # 4. Seed Open Emergency Incident
        print("[SafeDrive AI] Seeding Demonstration Emergency Incident...")
        first_driver = db.query(User).filter(User.email == "rahul.driver@safedrive.ai").first()
        if first_driver:
            existing_emergency = db.query(EmergencyIncident).filter(
                EmergencyIncident.driver_id == first_driver.id,
                EmergencyIncident.status.in_([IncidentStatus.TRIGGERED.value, IncidentStatus.ALERTED.value])
            ).first()

            if not existing_emergency:
                active_trip = db.query(Trip).filter(Trip.driver_id == first_driver.id, Trip.status == TripStatus.ACTIVE.value).first()
                emergency = EmergencyIncident(
                    trip_id=active_trip.id if active_trip else None,
                    driver_id=first_driver.id,
                    incident_type=IncidentType.CRASH.value,
                    status=IncidentStatus.TRIGGERED.value,
                    latitude=12.9740,
                    longitude=77.6050,
                    location_address="MG Road near Garuda Mall Corridor",
                    countdown_cancelled=False,
                    escalation_level=2,
                    medical_snapshot={
                        "blood_group": "O+",
                        "emergency_contact": "Priya Sharma (+919876543211)",
                        "allergies": "None",
                        "driver_phone": first_driver.phone
                    },
                    notes="Automated crash detection: 4.2g deceleration spike with sudden speed reduction.",
                    created_at=datetime.now(timezone.utc) - timedelta(minutes=6)
                )
                db.add(emergency)
                db.commit()

        # 5. Seed Real Driving Events Across 7 Days
        print("[SafeDrive AI] Seeding 7-Day Driving Events...")
        all_trips = db.query(Trip).all()
        event_types = ["overspeed", "harsh_brake", "drowsiness_ear", "sharp_turn"]
        now = datetime.now(timezone.utc)

        for i in range(7):
            day_time = now - timedelta(days=i, hours=2)
            for t in all_trips[:3]:
                ev = DrivingEvent(
                    trip_id=t.id,
                    vehicle_id=t.vehicle_id,
                    event_type=event_types[i % len(event_types)],
                    severity="medium" if i % 2 == 0 else "low",
                    latitude=t.start_lat or 12.9716,
                    longitude=t.start_lng or 77.5946,
                    confidence=0.92,
                    metadata_json={"g_force": 0.45 + (i * 0.05), "speed": 55.0},
                    timestamp=day_time
                )
                db.add(ev)
        db.commit()

        # 6. Seed Demonstration Hazards
        print("[SafeDrive AI] Seeding Road Hazards...")
        hazards_data = [
            {
                "title": "Severe Deep Pothole (200m ahead)",
                "type": HazardType.POTHOLE.value,
                "severity": HazardSeverity.CRITICAL.value,
                "status": HazardStatus.REPORTED.value,
                "lat": 12.9740,
                "lng": 77.6090,
                "address": "MG Road near Trinity Metro Station",
                "desc": "Deep crater pothole in central driving lane, high risk of tyre burst or bike skid.",
                "confirmations": 9
            },
            {
                "title": "Fallen Banyan Tree Branch Blocking Right Lane",
                "type": HazardType.FALLEN_TREE.value,
                "severity": HazardSeverity.HIGH.value,
                "status": HazardStatus.IN_PROGRESS.value,
                "lat": 12.9650,
                "lng": 77.6250,
                "address": "Domlur Flyover Corridor",
                "desc": "Heavy branch fell during storm, partially blocking speed lane.",
                "confirmations": 6
            },
            {
                "title": "Monsoon Waterlogging with Submerged Manhole",
                "type": HazardType.WATERLOGGING.value,
                "severity": HazardSeverity.MEDIUM.value,
                "status": HazardStatus.ASSIGNED.value,
                "lat": 12.9350,
                "lng": 77.6180,
                "address": "Sony World Junction, Koramangala",
                "desc": "Standing rainwater approx 15cm deep slow-down zone.",
                "confirmations": 4
            },
            {
                "title": "Repaired Asphalt Settlement Crack",
                "type": HazardType.CRACK.value,
                "severity": HazardSeverity.LOW.value,
                "status": HazardStatus.FIXED.value,
                "lat": 12.9280,
                "lng": 77.6290,
                "address": "Koramangala 6th Block Main Road",
                "desc": "Asphalt settlement crack successfully sealed by maintenance crew.",
                "confirmations": 2
            }
        ]

        for h in hazards_data:
            existing_h = db.query(Hazard).filter(Hazard.title == h["title"]).first()
            if not existing_h:
                new_h = Hazard(
                    reporter_id=first_driver.id if first_driver else 1,
                    hazard_type=h["type"],
                    severity=h["severity"],
                    status=h["status"],
                    title=h["title"],
                    description=h["desc"],
                    latitude=h["lat"],
                    longitude=h["lng"],
                    address=h["address"],
                    assigned_department="Bengaluru Road Safety & Pothole Taskforce",
                    assigned_officer_id=officer_user.id if officer_user else None,
                    confirmation_count=h["confirmations"],
                    confidence=0.94
                )
                db.add(new_h)
                db.flush()

                hist = HazardStatusHistory(
                    hazard_id=new_h.id,
                    previous_status=None,
                    new_status=h["status"],
                    changed_by_user_id=officer_user.id if officer_user else 1,
                    notes=f"Status: {h['status']}"
                )
                db.add(hist)

        # 7. Seed Model Versions
        if not db.query(ModelVersion).filter(ModelVersion.name == "hazard_classifier").first():
            db.add(ModelVersion(
                name="hazard_classifier",
                version="1.0.0",
                model_type="RandomForestClassifier-FeatureCNN",
                metrics_json={"accuracy": 1.0, "classes": ["pothole", "crack", "waterlogging", "fallen_tree", "normal_road"]},
                hyperparameters={"n_estimators": 80, "max_depth": 12},
                artifact_path="backend/app/ml/artifacts/hazard_classifier.joblib",
                is_active=True
            ))
        if not db.query(ModelVersion).filter(ModelVersion.name == "risk_predictor").first():
            db.add(ModelVersion(
                name="risk_predictor",
                version="1.0.0",
                model_type="XGBoost Classifier",
                metrics_json={"accuracy": 0.8533, "roc_auc": 0.9626, "f1": 0.8492, "precision": 0.8525, "recall": 0.8533},
                hyperparameters={"n_estimators": 120, "max_depth": 4, "learning_rate": 0.08},
                artifact_path="backend/app/ml/artifacts/risk_model.joblib",
                is_active=True
            ))

        db.commit()
        print("[SafeDrive AI] Database seeded successfully with real demonstration fleet!")

    except Exception as e:
        db.rollback()
        print(f"[SafeDrive AI] Error seeding database: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    init_and_seed_db()
