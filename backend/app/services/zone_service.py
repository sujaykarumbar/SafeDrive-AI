"""
SafeDrive AI — Zone Alerts & Geofencing Engine (Phase 3)
Manages:
1. School Zones (OpenStreetMap amenity=school with school hours)
2. Hospital Zones (ST_DWithin buffer, silent zone speed limit)
3. Accident Hotspots (DBSCAN clusters of historical accident sites)
4. Speed Breakers & Sharp Curves
Implements voice-guidance alerts with rate-limiting.
"""

import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

# Calibrated Bengaluru Reference Coordinates
SAFETY_ZONES = [
    {
        "id": "school_nps_indiranagar",
        "name": "National Public School Indiranagar",
        "zone_type": "school",
        "latitude": 12.9780,
        "longitude": 77.6405,
        "radius_meters": 220,
        "speed_limit_kmh": 25,
        "active_hours": [
            {"start": "07:30", "end": "09:30"},
            {"start": "14:00", "end": "16:30"}
        ],
        "speech_warning": "School zone ahead. Slow down to 25 km/h. Watch for children crossing.",
        "icon": "school"
    },
    {
        "id": "school_bishop_cotton",
        "name": "Bishop Cotton Boys' School",
        "zone_type": "school",
        "latitude": 12.9698,
        "longitude": 77.6012,
        "radius_meters": 200,
        "speed_limit_kmh": 25,
        "active_hours": [
            {"start": "07:30", "end": "09:30"},
            {"start": "14:15", "end": "16:00"}
        ],
        "speech_warning": "School zone ahead. Strictly maintain 25 km/h.",
        "icon": "school"
    },
    {
        "id": "hospital_manipal_oldairport",
        "name": "Manipal Hospital Old Airport Road",
        "zone_type": "hospital",
        "latitude": 12.9592,
        "longitude": 77.6534,
        "radius_meters": 250,
        "speed_limit_kmh": 30,
        "active_hours": [{"start": "00:00", "end": "23:59"}],
        "speech_warning": "Hospital emergency zone. Maintain 30 km/h and refrain from honking.",
        "icon": "hospital"
    },
    {
        "id": "hospital_chinmaya_mission",
        "name": "Chinmaya Mission Hospital",
        "zone_type": "hospital",
        "latitude": 12.9796,
        "longitude": 77.6385,
        "radius_meters": 180,
        "speed_limit_kmh": 30,
        "active_hours": [{"start": "00:00", "end": "23:59"}],
        "speech_warning": "Hospital zone. Ambulance entry corridor. Keep right lane clear.",
        "icon": "hospital"
    },
    {
        "id": "hotspot_silk_board",
        "name": "Central Silk Board Junction (DBSCAN Cluster #1)",
        "zone_type": "accident_hotspot",
        "latitude": 12.9177,
        "longitude": 77.6238,
        "radius_meters": 300,
        "speed_limit_kmh": 40,
        "active_hours": [{"start": "00:00", "end": "23:59"}],
        "speech_warning": "High accident hotspot ahead. Multi-lane merge point. Maintain safe following distance.",
        "icon": "alert-triangle"
    },
    {
        "id": "hotspot_domlur_flyover",
        "name": "Domlur Flyover Sharp Descent (DBSCAN Cluster #2)",
        "zone_type": "accident_hotspot",
        "latitude": 12.9620,
        "longitude": 77.6410,
        "radius_meters": 220,
        "speed_limit_kmh": 35,
        "active_hours": [{"start": "00:00", "end": "23:59"}],
        "speech_warning": "Sharp blind curve ahead on flyover ramp. Reduce speed to 35 km/h.",
        "icon": "alert-triangle"
    },
    {
        "id": "hotspot_trinity_circle",
        "name": "Trinity Circle Metro Intersection",
        "zone_type": "accident_hotspot",
        "latitude": 12.9733,
        "longitude": 77.6200,
        "radius_meters": 180,
        "speed_limit_kmh": 35,
        "active_hours": [{"start": "00:00", "end": "23:59"}],
        "speech_warning": "Heavy pedestrian crossing and rapid lane shifts ahead.",
        "icon": "alert-triangle"
    }
]


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two points in meters."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


class ZoneAlertService:
    def __init__(self):
        self.zones = SAFETY_ZONES
        # Driver-specific rate limiting: { (driver_id, zone_id): last_alert_timestamp }
        self._last_alerts: Dict[str, datetime] = {}

    def get_all_zones(self) -> List[Dict[str, Any]]:
        """Returns all registered safety zones for map overlay."""
        return self.zones

    def is_hour_active(self, zone: Dict[str, Any], check_time: Optional[datetime] = None) -> bool:
        """Determines if a zone's timing rules are currently active."""
        now = check_time or datetime.now()
        current_hm = now.strftime("%H:%M")

        for window in zone.get("active_hours", []):
            if window["start"] <= current_hm <= window["end"]:
                return True
        return False

    def check_proximity(
        self,
        latitude: float,
        longitude: float,
        current_speed_kmh: float = 0.0,
        driver_id: Optional[int] = None,
        check_time: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Evaluates current coordinates against all safety geofences.
        Returns active warnings with rate-limiting enforcement.
        """
        now = check_time or datetime.now(timezone.utc)
        triggered_alerts = []

        for zone in self.zones:
            dist = haversine_distance_meters(latitude, longitude, zone["latitude"], zone["longitude"])
            # Buffer distance: trigger warning within zone radius + 50m approach threshold
            trigger_dist = zone["radius_meters"] + 50.0

            if dist <= trigger_dist:
                is_active = self.is_hour_active(zone, now)
                # School zones receive higher penalty during active school hours
                if zone["zone_type"] == "school" and not is_active:
                    # Still alert for school crossing, but with softer tone outside hours
                    speed_limit = 35
                    warning_text = f"School zone ahead. Caution, speed limit {speed_limit} km/h."
                else:
                    speed_limit = zone["speed_limit_kmh"]
                    warning_text = zone["speech_warning"]

                # Rate limiting check (suppress if alerted in the last 180 seconds)
                alert_key = f"{driver_id or 0}_{zone['id']}"
                last_time = self._last_alerts.get(alert_key)
                suppressed = False
                if last_time and (now - last_time).total_seconds() < 180:
                    suppressed = True
                else:
                    self._last_alerts[alert_key] = now

                is_overspeed = current_speed_kmh > speed_limit

                triggered_alerts.append({
                    "zone_id": zone["id"],
                    "zone_name": zone["name"],
                    "zone_type": zone["zone_type"],
                    "distance_meters": round(dist, 1),
                    "speed_limit_kmh": speed_limit,
                    "current_speed_kmh": round(current_speed_kmh, 1),
                    "is_overspeed": is_overspeed,
                    "is_active_hour": is_active,
                    "speech_warning": warning_text,
                    "is_suppressed": suppressed
                })

        return triggered_alerts


zone_service = ZoneAlertService()
