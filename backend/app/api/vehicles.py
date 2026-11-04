from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.models.vehicle import Vehicle, VehicleProfile, VehicleCategory
from backend.app.schemas.vehicle import VehicleCreate, VehicleOut, VehicleProfileOut, VehicleUpdate
from backend.app.api.deps import get_current_user, get_current_driver, log_audit

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])

DEFAULT_THRESHOLDS = {
    "bike": {
        "max_speed_kmh": 80.0,
        "harsh_brake_g": 0.55,
        "harsh_accel_g": 0.50,
        "sharp_turn_deg_s": 45.0,
        "break_reminder_hours": 1.5,
        "vibration_tolerance": "high",
        "notes": "Two-wheeler calibration with higher lean tolerance and frequent rest reminder"
    },
    "scooter": {
        "max_speed_kmh": 70.0,
        "harsh_brake_g": 0.50,
        "harsh_accel_g": 0.45,
        "sharp_turn_deg_s": 40.0,
        "break_reminder_hours": 1.5,
        "vibration_tolerance": "medium",
        "notes": "Urban two-wheeler profile calibrated for light commuter use"
    },
    "car": {
        "max_speed_kmh": 110.0,
        "harsh_brake_g": 0.45,
        "harsh_accel_g": 0.40,
        "sharp_turn_deg_s": 35.0,
        "break_reminder_hours": 2.5,
        "vibration_tolerance": "normal",
        "notes": "Standard passenger vehicle baseline safety profile"
    },
    "taxi": {
        "max_speed_kmh": 100.0,
        "harsh_brake_g": 0.42,
        "harsh_accel_g": 0.38,
        "sharp_turn_deg_s": 32.0,
        "break_reminder_hours": 2.0,
        "vibration_tolerance": "normal",
        "notes": "Commercial passenger profile with strict fatigue and smooth ride criteria"
    },
    "truck": {
        "max_speed_kmh": 80.0,
        "harsh_brake_g": 0.35,
        "harsh_accel_g": 0.30,
        "sharp_turn_deg_s": 25.0,
        "break_reminder_hours": 3.0,
        "vibration_tolerance": "low",
        "notes": "Heavy vehicle profile with conservative deceleration and rollover risk bounds"
    },
    "bus": {
        "max_speed_kmh": 75.0,
        "harsh_brake_g": 0.32,
        "harsh_accel_g": 0.28,
        "sharp_turn_deg_s": 22.0,
        "break_reminder_hours": 2.5,
        "vibration_tolerance": "low",
        "notes": "Passenger transit safety profile prioritising passenger stability and early braking"
    }
}


@router.get("/categories")
def get_vehicle_categories(db: Session = Depends(get_db)):
    """Return all supported vehicle categories with their reviewed threshold profiles."""
    profiles = db.query(VehicleProfile).all()
    if not profiles:
        # Return fallback configuration dictionary
        return [
            {
                "category": cat,
                "version": "1.0.0",
                "threshold_config": DEFAULT_THRESHOLDS[cat],
                "description": DEFAULT_THRESHOLDS[cat]["notes"]
            }
            for cat in DEFAULT_THRESHOLDS
        ]
    return [
        {
            "category": p.category,
            "version": p.version,
            "threshold_config": p.threshold_config,
            "description": p.description
        }
        for p in profiles
    ]


@router.get("/", response_model=List[VehicleOut])
def list_my_vehicles(
    current_user: User = Depends(get_current_driver),
    db: Session = Depends(get_db)
):
    """List vehicles registered by the logged-in driver."""
    vehicles = db.query(Vehicle).filter(Vehicle.driver_id == current_user.id).order_by(Vehicle.is_default.desc()).all()
    return vehicles


@router.post("/", response_model=VehicleOut, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    vehicle_in: VehicleCreate,
    current_user: User = Depends(get_current_driver),
    db: Session = Depends(get_db)
):
    """Add a new vehicle profile to the driver's garage."""
    valid_categories = [c.value for c in VehicleCategory]
    if vehicle_in.category.lower() not in valid_categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid vehicle category. Must be one of: {', '.join(valid_categories)}"
        )

    # If this is driver's first vehicle or marked default, reset other defaults
    existing_count = db.query(Vehicle).filter(Vehicle.driver_id == current_user.id).count()
    if existing_count == 0 or vehicle_in.is_default:
        db.query(Vehicle).filter(Vehicle.driver_id == current_user.id).update({"is_default": False})

    vehicle = Vehicle(
        driver_id=current_user.id,
        category=vehicle_in.category.lower(),
        make=vehicle_in.make,
        model=vehicle_in.model,
        registration_label=vehicle_in.registration_label.upper().strip(),
        subtype=vehicle_in.subtype,
        is_default=True if existing_count == 0 else vehicle_in.is_default
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)

    log_audit(db, current_user.id, "VEHICLE_CREATED", "vehicle", str(vehicle.id), {
        "category": vehicle.category,
        "registration": vehicle.registration_label
    })

    return vehicle


@router.put("/{vehicle_id}/default", response_model=VehicleOut)
def set_default_vehicle(
    vehicle_id: int,
    current_user: User = Depends(get_current_driver),
    db: Session = Depends(get_db)
):
    """Set a vehicle as the default active vehicle for upcoming trips."""
    vehicle = db.query(Vehicle).filter(
        Vehicle.id == vehicle_id,
        Vehicle.driver_id == current_user.id
    ).first()
    if not vehicle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")

    db.query(Vehicle).filter(Vehicle.driver_id == current_user.id).update({"is_default": False})
    vehicle.is_default = True
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.delete("/{vehicle_id}")
def delete_vehicle(
    vehicle_id: int,
    current_user: User = Depends(get_current_driver),
    db: Session = Depends(get_db)
):
    """Delete a vehicle from the driver's garage."""
    vehicle = db.query(Vehicle).filter(
        Vehicle.id == vehicle_id,
        Vehicle.driver_id == current_user.id
    ).first()
    if not vehicle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")

    db.delete(vehicle)
    db.commit()
    return {"message": "Vehicle deleted successfully"}
