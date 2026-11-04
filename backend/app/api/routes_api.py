"""
SafeDrive AI — Smart Navigation & Safe Route API Endpoints (Google Maps Platform + SafeDrive Engine)
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.services.google_maps_service import google_maps_service
from backend.app.services.zone_service import zone_service
from backend.app.services.traffic_service import traffic_service

router = APIRouter(prefix="/routes", tags=["Routing & Safe Navigation"])


class CheckZonesRequest(BaseModel):
    latitude: float = Field(..., example=12.9780)
    longitude: float = Field(..., example=77.6405)
    speed_kmh: Optional[float] = Field(0.0, example=42.0)
    driver_id: Optional[int] = Field(None, example=1)


class Waypoint(BaseModel):
    latitude: float
    longitude: float
    name: Optional[str] = None


class VehicleConstraints(BaseModel):
    category: str = Field("car", example="truck")
    height_meters: Optional[float] = Field(None, example=3.8)
    weight_tons: Optional[float] = Field(None, example=16.0)
    width_meters: Optional[float] = Field(None, example=2.5)
    has_hazardous_load: Optional[bool] = Field(False)


class RoutePlanRequest(BaseModel):
    origin: Waypoint
    destination: Waypoint
    waypoints: Optional[List[Waypoint]] = Field(default_factory=list)
    vehicle_constraints: Optional[VehicleConstraints] = None
    avoid_tolls: Optional[bool] = False
    avoid_highways: Optional[bool] = False
    weather: Optional[str] = "clear"


@router.get("/config")
def get_map_config():
    """
    Returns public Google Maps Platform configuration for mobile and web clients.
    Includes enabled state, client-side SDK key, and supported vehicle routing modes.
    """
    return google_maps_service.get_client_config()


@router.get("/directions")
def get_safe_directions(
    start_lat: float = Query(12.9716, description="Start latitude"),
    start_lng: float = Query(77.5946, description="Start longitude"),
    end_lat: float = Query(12.9784, description="Destination latitude"),
    end_lng: float = Query(77.6408, description="Destination longitude"),
    vehicle_category: Optional[str] = Query("car", description="bike, scooter, car, taxi, truck, bus"),
    avoid_tolls: Optional[bool] = Query(False, description="Avoid toll roads"),
    avoid_highways: Optional[bool] = Query(False, description="Avoid highways"),
    weather: Optional[str] = Query("clear", description="clear, rain, heavy_rain"),
    db: Session = Depends(get_db)
):
    """
    Computes candidate routes (SafeDrive Recommended, Fastest, Shortest).
    Uses Google Maps Routes/Directions API when configured, evaluating SafeDrive risk scoring
    against active reported hazards, school zones, and accident hotspots.
    """
    return google_maps_service.get_directions(
        start_lat=start_lat,
        start_lng=start_lng,
        end_lat=end_lat,
        end_lng=end_lng,
        waypoints=None,
        vehicle_category=vehicle_category or "car",
        avoid_tolls=avoid_tolls or False,
        avoid_highways=avoid_highways or False,
        weather=weather or "clear",
        db=db
    )


@router.post("/plan")
def plan_multi_stop_route(
    payload: RoutePlanRequest,
    db: Session = Depends(get_db)
):
    """
    Advanced route planning with multi-stop waypoints and vehicle dimension constraints.
    Supports trucks, buses, motorized 2-wheelers, and passenger fleets.
    """
    wps = [{"latitude": wp.latitude, "longitude": wp.longitude} for wp in (payload.waypoints or [])]
    vcat = payload.vehicle_constraints.category if payload.vehicle_constraints else "car"

    return google_maps_service.get_directions(
        start_lat=payload.origin.latitude,
        start_lng=payload.origin.longitude,
        end_lat=payload.destination.latitude,
        end_lng=payload.destination.longitude,
        waypoints=wps if wps else None,
        vehicle_category=vcat,
        avoid_tolls=payload.avoid_tolls or False,
        avoid_highways=payload.avoid_highways or False,
        weather=payload.weather or "clear",
        db=db
    )


@router.get("/places/autocomplete")
def autocomplete_places(
    query: str = Query(..., min_length=2, description="Search query string"),
    lat: Optional[float] = Query(12.9716, description="Reference latitude"),
    lng: Optional[float] = Query(77.5946, description="Reference longitude"),
    radius: Optional[int] = Query(25000, description="Search radius in meters")
):
    """
    Google Places autocomplete proxy.
    Returns destination suggestions with place_id, main text, and secondary description.
    """
    predictions = google_maps_service.autocomplete_places(
        query=query,
        lat=lat,
        lng=lng,
        radius_m=radius or 25000
    )
    return {"query": query, "count": len(predictions), "predictions": predictions}


@router.get("/places/details")
def get_place_details(
    place_id: str = Query(..., description="Google Places place_id or SafeDrive internal POI ID")
):
    """
    Retrieves full details (coordinates, name, formatted address, rating) for a place.
    """
    details = google_maps_service.get_place_details(place_id)
    if not details:
        raise HTTPException(status_code=404, detail="Place not found")
    return details


@router.get("/places/reverse-geocode")
def reverse_geocode(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude")
):
    """
    Reverse geocodes GPS coordinates into formatted human-readable street address.
    """
    return google_maps_service.reverse_geocode(lat=lat, lng=lng)


@router.get("/places/nearby")
def search_nearby_places(
    lat: float = Query(12.9716, description="Current latitude"),
    lng: float = Query(77.5946, description="Current longitude"),
    type: str = Query("gas_station", description="gas_station, charging_station, hospital, parking, restaurant, car_repair"),
    radius: Optional[int] = Query(5000, description="Search radius in meters")
):
    """
    Searches for nearby points of interest along the route or around current position.
    Categories: petrol/gas_station, ev_charger, hospital, parking, restaurant, car_repair.
    """
    places = google_maps_service.search_nearby(
        lat=lat,
        lng=lng,
        place_type=type,
        radius_m=radius or 5000
    )
    return {
        "latitude": lat,
        "longitude": lng,
        "type": type,
        "radius_meters": radius,
        "results_count": len(places),
        "places": places
    }


@router.post("/check-zones")
def check_zone_proximity(payload: CheckZonesRequest):
    """
    Evaluates current GPS location against School, Hospital, and DBSCAN Hotspot geofences.
    Returns speech guidance text for turn-by-turn voice alerts.
    """
    alerts = zone_service.check_proximity(
        latitude=payload.latitude,
        longitude=payload.longitude,
        current_speed_kmh=payload.speed_kmh or 0.0,
        driver_id=payload.driver_id
    )
    return {
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "active_alerts_count": len(alerts),
        "alerts": alerts
    }


@router.get("/safety-zones")
def list_safety_zones():
    """
    Returns all registered School Zones, Hospital Zones, and DBSCAN Accident Hotspots.
    Used by Leaflet web map and Flutter mobile map for zone boundary rendering.
    """
    return zone_service.get_all_zones()


@router.get("/traffic-forecast")
def get_traffic_forecast(
    weather: Optional[str] = Query("clear", description="clear, rain, heavy_rain")
):
    """
    Returns 30-60 minute congestion forecast and optimal departure recommendation.
    """
    return traffic_service.forecast_traffic_window(weather=weather)
