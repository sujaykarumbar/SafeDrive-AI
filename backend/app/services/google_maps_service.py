"""
SafeDrive AI — Google Maps Platform Service Integration
Provides server-side integration for:
1. Google Routes API / Directions API with multi-vehicle profiles (2-wheeler, car, truck, bus).
2. Google Places API (Autocomplete, Place Details, Nearby Places Search).
3. Geocoding & Reverse Geocoding API.
4. SafeDrive AI Safety Intelligence Scoring overlay (Hazards, School Zones, Accident Hotspots).
5. Polyline decoding and turn-by-turn guidance extraction.
6. High-precision local fallback engine for offline or keyless environments.
"""

import os
import json
import math
import urllib.parse
import urllib.request
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.services.route_engine import route_engine
from backend.app.services.zone_service import zone_service, haversine_distance_meters
from backend.app.services.traffic_service import traffic_service


def decode_google_polyline(polyline_str: str) -> List[List[float]]:
    """
    Decodes an encoded Google Maps polyline string into [[lat, lng], ...].
    Standard Google Polyline Algorithm Format.
    """
    points = []
    index = 0
    length = len(polyline_str)
    lat = 0
    lng = 0

    while index < length:
        # Decode Latitude
        shift = 0
        result = 0
        while True:
            byte = ord(polyline_str[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break
        dlat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += dlat

        # Decode Longitude
        shift = 0
        result = 0
        while True:
            if index >= length:
                break
            byte = ord(polyline_str[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break
        dlng = ~(result >> 1) if (result & 1) else (result >> 1)
        lng += dlng

        points.append([lat / 1e5, lng / 1e5])

    return points


class GoogleMapsService:
    def __init__(self):
        self.server_api_key = settings.GOOGLE_MAPS_SERVER_API_KEY or ""
        self.client_api_key = settings.GOOGLE_MAPS_CLIENT_API_KEY or ""
        self._place_cache: Dict[str, Dict[str, Any]] = {}

    @property
    def is_configured(self) -> bool:
        """Returns True if a live Google Maps Server API Key is provided."""
        return bool(self.server_api_key and self.server_api_key.strip() and not self.server_api_key.startswith("your_"))

    def get_client_config(self) -> Dict[str, Any]:
        """Provides restricted client configuration to mobile & web clients."""
        return {
            "google_maps_configured": self.is_configured,
            "client_api_key": self.client_api_key if self.is_configured else "",
            "service_provider": "Google Maps Platform" if self.is_configured else "SafeDrive AI Native Geospatial Engine",
            "supported_modes": ["DRIVE", "TWO_WHEELER", "TRUCK", "BUS"],
            "map_style": "midnight_navy"
        }

    # =========================================================================
    # 1. DIRECTIONS & ROUTE PLANNING
    # =========================================================================
    def get_directions(
        self,
        start_lat: float,
        start_lng: float,
        end_lat: float,
        end_lng: float,
        waypoints: Optional[List[Dict[str, float]]] = None,
        vehicle_category: str = "car",
        avoid_tolls: bool = False,
        avoid_highways: bool = False,
        weather: str = "clear",
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Retrieves candidate routes (Safest, Fastest, Shortest).
        Uses live Google Directions API if configured, attaching SafeDrive AI risk scores.
        Falls back seamlessly to SafeDrive's high-precision candidate routing engine.
        """
        vcat = (vehicle_category or "car").lower()
        if self.is_configured:
            try:
                live_routes = self._fetch_google_directions(
                    start_lat=start_lat,
                    start_lng=start_lng,
                    end_lat=end_lat,
                    end_lng=end_lng,
                    waypoints=waypoints,
                    vehicle_category=vcat,
                    avoid_tolls=avoid_tolls,
                    avoid_highways=avoid_highways
                )
                if live_routes and len(live_routes) > 0:
                    # Evaluate SafeDrive risk score for each live Google route
                    scored_routes = self._score_live_routes(live_routes, vcat, weather, db)
                    traffic_fc = traffic_service.forecast_traffic_window(weather=weather)
                    return {
                        "source": "google_maps_api",
                        "start": {"latitude": start_lat, "longitude": start_lng},
                        "destination": {"latitude": end_lat, "longitude": end_lng},
                        "vehicle_category": vcat,
                        "avoid_tolls": avoid_tolls,
                        "weather": weather,
                        "candidate_routes": scored_routes,
                        "traffic_forecast": traffic_fc,
                        "best_departure_advice": traffic_fc["recommendation"]
                    }
            except Exception as e:
                # Log error and fallback gracefully
                print(f"[GoogleMapsService] Directions API error, falling back to local engine: {e}")

        # Local High-Precision Route Engine Fallback
        local_candidates = route_engine.generate_candidate_routes(
            start_lat=start_lat,
            start_lng=start_lng,
            end_lat=end_lat,
            end_lng=end_lng,
            vehicle_category=vcat,
            weather=weather,
            db=db
        )
        traffic_fc = traffic_service.forecast_traffic_window(weather=weather)

        return {
            "source": "safedrive_local_engine",
            "start": {"latitude": start_lat, "longitude": start_lng},
            "destination": {"latitude": end_lat, "longitude": end_lng},
            "vehicle_category": vcat,
            "avoid_tolls": avoid_tolls,
            "weather": weather,
            "candidate_routes": local_candidates,
            "traffic_forecast": traffic_fc,
            "best_departure_advice": traffic_fc["recommendation"]
        }

    def _fetch_google_directions(
        self,
        start_lat: float,
        start_lng: float,
        end_lat: float,
        end_lng: float,
        waypoints: Optional[List[Dict[str, float]]] = None,
        vehicle_category: str = "car",
        avoid_tolls: bool = False,
        avoid_highways: bool = False
    ) -> List[Dict[str, Any]]:
        """Calls Google Maps Directions API with traffic model and alternatives enabled."""
        origin = f"{start_lat},{start_lng}"
        destination = f"{end_lat},{end_lng}"

        # Mode selection: Two-wheeler mode supported in India/SE Asia
        mode = "driving"
        if vehicle_category in ["bike", "scooter"]:
            mode = "two_wheeler"

        params = {
            "origin": origin,
            "destination": destination,
            "mode": mode,
            "alternatives": "true",
            "departure_time": "now",
            "key": self.server_api_key
        }

        avoid = []
        if avoid_tolls:
            avoid.append("tolls")
        if avoid_highways or vehicle_category in ["bike", "scooter"]:
            avoid.append("highways")
        if avoid:
            params["avoid"] = "|".join(avoid)

        if waypoints:
            pts = [f"{wp['latitude']},{wp['longitude']}" for wp in waypoints]
            params["waypoints"] = "|".join(pts)

        url = "https://maps.googleapis.com/maps/api/directions/json?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={"User-Agent": "SafeDriveAI-Backend/1.0"})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())

        if data.get("status") != "OK":
            print(f"[GoogleMapsService] Directions status: {data.get('status')} - {data.get('error_message')}")
            return []

        routes = []
        for raw_route in data.get("routes", []):
            leg = raw_route["legs"][0] if raw_route.get("legs") else {}
            distance_m = leg.get("distance", {}).get("value", 0)
            duration_s = leg.get("duration_in_traffic", leg.get("duration", {})).get("value", 0)
            overview_polyline = raw_route.get("overview_polyline", {}).get("points", "")
            decoded_points = decode_google_polyline(overview_polyline)

            steps = []
            for st in leg.get("steps", []):
                steps.append({
                    "instruction": st.get("html_instructions", "").replace("<b>", "").replace("</b>", "").replace('<div style="font-size:0.9em">', " (").replace("</div>", ")"),
                    "distance_m": st.get("distance", {}).get("value", 0),
                    "duration_s": st.get("duration", {}).get("value", 0),
                    "maneuver": st.get("maneuver", "straight"),
                    "start_location": [st.get("start_location", {}).get("lat"), st.get("start_location", {}).get("lng")],
                    "end_location": [st.get("end_location", {}).get("lat"), st.get("end_location", {}).get("lng")]
                })

            routes.append({
                "summary": raw_route.get("summary", "Route"),
                "distance_km": round(distance_m / 1000.0, 2),
                "duration_minutes": round(duration_s / 60.0, 1),
                "waypoints": decoded_points,
                "turn_by_turn": steps,
                "warnings": raw_route.get("warnings", [])
            })

        return routes

    def _score_live_routes(
        self,
        live_routes: List[Dict[str, Any]],
        vehicle_category: str,
        weather: str,
        db: Optional[Session]
    ) -> List[Dict[str, Any]]:
        """
        Scores Google Routes with SafeDrive AI Risk Formula:
        route_cost = distance_time + w1*hazards + w2*zones + w3*traffic + w4*hotspots.
        Labels the safest as 'SafeDrive Recommended'.
        """
        candidate_results = []
        for idx, r in enumerate(live_routes):
            cost_data = route_engine.calculate_route_cost(
                waypoints=r["waypoints"],
                base_distance_km=r["distance_km"],
                base_duration_min=r["duration_minutes"],
                vehicle_category=vehicle_category,
                weather=weather,
                db=db
            )

            candidate_results.append({
                "route_type": "google_alt_" + str(idx),
                "label": f"Route {idx + 1} ({r['summary']})",
                "recommended": False,
                "summary": r["summary"],
                "distance_km": r["distance_km"],
                "duration_minutes": r["duration_minutes"],
                "safety_score": cost_data["safety_score"],
                "route_cost": cost_data["route_cost"],
                "reasons": cost_data["reasons"],
                "color_hex": "#5DE0C1",
                "waypoints": r["waypoints"],
                "turn_by_turn": r["turn_by_turn"],
                "hazards_on_route": cost_data["hazards_on_route"],
                "zones_on_route": cost_data["zones_on_route"]
            })

        if not candidate_results:
            return []

        # Find route with highest safety score
        safest = max(candidate_results, key=lambda x: x["safety_score"])
        safest["recommended"] = True
        safest["route_type"] = "safest"
        safest["label"] = "SafeDrive Recommended"
        safest["color_hex"] = "#5DE0C1"  # Brand mint-teal

        # Label fastest
        fastest = min(candidate_results, key=lambda x: x["duration_minutes"])
        if fastest != safest:
            fastest["route_type"] = "fastest"
            fastest["label"] = "Fastest Route"
            fastest["color_hex"] = "#F5C46A"  # Amber

        return candidate_results

    # =========================================================================
    # 2. PLACES AUTOCOMPLETE & DETAILS
    # =========================================================================
    def autocomplete_places(
        self,
        query: str,
        lat: Optional[float] = 12.9716,
        lng: Optional[float] = 77.5946,
        radius_m: int = 25000
    ) -> List[Dict[str, Any]]:
        """
        Provides Google Places autocomplete suggestions.
        Falls back to comprehensive urban POI catalog if key is not configured.
        """
        if not query or len(query.strip()) < 2:
            return []

        if self.is_configured:
            try:
                params = {
                    "input": query,
                    "location": f"{lat},{lng}" if lat and lng else "12.9716,77.5946",
                    "radius": str(radius_m),
                    "key": self.server_api_key
                }
                url = "https://maps.googleapis.com/maps/api/place/autocomplete/json?" + urllib.parse.urlencode(params)
                req = urllib.request.Request(url, headers={"User-Agent": "SafeDriveAI-Backend/1.0"})
                with urllib.request.urlopen(req, timeout=4) as response:
                    data = json.loads(response.read().decode())
                if data.get("status") in ["OK", "ZERO_RESULTS"]:
                    predictions = []
                    for p in data.get("predictions", []):
                        predictions.append({
                            "place_id": p.get("place_id"),
                            "description": p.get("description"),
                            "main_text": p.get("structured_formatting", {}).get("main_text", p.get("description")),
                            "secondary_text": p.get("structured_formatting", {}).get("secondary_text", ""),
                            "types": p.get("types", [])
                        })
                    return predictions
            except Exception as e:
                print(f"[GoogleMapsService] Autocomplete error: {e}")

        # Local Intelligent Autocomplete Catalog
        return self._local_places_autocomplete(query)

    def get_place_details(self, place_id: str) -> Dict[str, Any]:
        """Fetches detailed place info (lat, lng, address, name) by place_id."""
        if self.is_configured and place_id and not place_id.startswith("sd_"):
            try:
                params = {
                    "place_id": place_id,
                    "fields": "name,formatted_address,geometry,type,rating,user_ratings_total,opening_hours",
                    "key": self.server_api_key
                }
                url = "https://maps.googleapis.com/maps/api/place/details/json?" + urllib.parse.urlencode(params)
                req = urllib.request.Request(url, headers={"User-Agent": "SafeDriveAI-Backend/1.0"})
                with urllib.request.urlopen(req, timeout=4) as response:
                    data = json.loads(response.read().decode())
                if data.get("status") == "OK":
                    res = data.get("result", {})
                    geom = res.get("geometry", {}).get("location", {})
                    return {
                        "place_id": place_id,
                        "name": res.get("name"),
                        "formatted_address": res.get("formatted_address"),
                        "latitude": geom.get("lat"),
                        "longitude": geom.get("lng"),
                        "rating": res.get("rating"),
                        "types": res.get("types", [])
                    }
            except Exception as e:
                print(f"[GoogleMapsService] Place details error: {e}")

        # Local details fallback
        return self._local_place_details(place_id)

    # =========================================================================
    # 3. REVERSE GEOCODING & NEARBY SEARCH
    # =========================================================================
    def reverse_geocode(self, lat: float, lng: float) -> Dict[str, Any]:
        """Converts coordinates to street address and locality."""
        if self.is_configured:
            try:
                params = {
                    "latlng": f"{lat},{lng}",
                    "key": self.server_api_key
                }
                url = "https://maps.googleapis.com/maps/api/geocode/json?" + urllib.parse.urlencode(params)
                req = urllib.request.Request(url, headers={"User-Agent": "SafeDriveAI-Backend/1.0"})
                with urllib.request.urlopen(req, timeout=4) as response:
                    data = json.loads(response.read().decode())
                if data.get("status") == "OK" and data.get("results"):
                    first = data["results"][0]
                    return {
                        "formatted_address": first.get("formatted_address"),
                        "latitude": lat,
                        "longitude": lng,
                        "place_id": first.get("place_id")
                    }
            except Exception as e:
                print(f"[GoogleMapsService] Reverse geocode error: {e}")

        # Local nearest reverse geocoding
        return self._local_reverse_geocode(lat, lng)

    def search_nearby(
        self,
        lat: float,
        lng: float,
        place_type: str = "gas_station",
        radius_m: int = 5000
    ) -> List[Dict[str, Any]]:
        """
        Finds nearby points of interest:
        petrol / gas_station, ev_charger / charging_station, hospital, parking, restaurant, car_repair.
        """
        api_type_map = {
            "fuel": "gas_station",
            "petrol": "gas_station",
            "gas_station": "gas_station",
            "ev_charging": "charging_station",
            "ev_charger": "charging_station",
            "hospital": "hospital",
            "parking": "parking",
            "restaurant": "restaurant",
            "repair": "car_repair",
            "car_repair": "car_repair"
        }
        mapped_type = api_type_map.get(place_type.lower(), "gas_station")

        if self.is_configured:
            try:
                params = {
                    "location": f"{lat},{lng}",
                    "radius": str(radius_m),
                    "type": mapped_type,
                    "key": self.server_api_key
                }
                url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json?" + urllib.parse.urlencode(params)
                req = urllib.request.Request(url, headers={"User-Agent": "SafeDriveAI-Backend/1.0"})
                with urllib.request.urlopen(req, timeout=4) as response:
                    data = json.loads(response.read().decode())
                if data.get("status") in ["OK", "ZERO_RESULTS"]:
                    results = []
                    for item in data.get("results", [])[:15]:
                        geom = item.get("geometry", {}).get("location", {})
                        item_lat = geom.get("lat")
                        item_lng = geom.get("lng")
                        dist = round(haversine_distance_meters(lat, lng, item_lat, item_lng) / 1000.0, 2)
                        results.append({
                            "place_id": item.get("place_id"),
                            "name": item.get("name"),
                            "category": mapped_type,
                            "address": item.get("vicinity") or item.get("name"),
                            "latitude": item_lat,
                            "longitude": item_lng,
                            "distance_km": dist,
                            "rating": item.get("rating", 4.5),
                            "open_now": item.get("opening_hours", {}).get("open_now", True)
                        })
                    return sorted(results, key=lambda x: x["distance_km"])
            except Exception as e:
                print(f"[GoogleMapsService] Nearby search error: {e}")

        # Local catalog
        return self._local_nearby_search(lat, lng, mapped_type, radius_m)

    # =========================================================================
    # LOCAL INTELLIGENT FALLBACK DATA CATALOG
    # =========================================================================
    def _local_places_autocomplete(self, query: str) -> List[Dict[str, Any]]:
        query_lower = query.lower().strip()
        catalog = [
            {"id": "sd_mg_road", "name": "MG Road Metro Station", "address": "Mahatma Gandhi Rd, Bengaluru, Karnataka 560001", "lat": 12.9756, "lng": 77.6066, "type": "transit_station"},
            {"id": "sd_indiranagar", "name": "Indiranagar 100 Feet Road", "address": "100 Feet Rd, HAL 2nd Stage, Indiranagar, Bengaluru 560038", "lat": 12.9784, "lng": 77.6408, "type": "point_of_interest"},
            {"id": "sd_koramangala", "name": "Koramangala 5th Block", "address": "80 Feet Rd, 5th Block, Koramangala, Bengaluru 560095", "lat": 12.9352, "lng": 77.6245, "type": "neighborhood"},
            {"id": "sd_whitefield", "name": "ITPB Whitefield Tech Park", "address": "ITPL Main Rd, Pattandur Agrahara, Whitefield, Bengaluru 560066", "lat": 12.9862, "lng": 77.7441, "type": "point_of_interest"},
            {"id": "sd_airport", "name": "Kempegowda International Airport (BLR)", "address": "KIAL Rd, Devanahalli, Bengaluru, Karnataka 560300", "lat": 13.1986, "lng": 77.7066, "type": "airport"},
            {"id": "sd_electronic_city", "name": "Electronic City Toll Gate Phase 1", "address": "Hosur Rd, Electronic City, Bengaluru 560100", "lat": 12.8452, "lng": 77.6602, "type": "point_of_interest"},
            {"id": "sd_manyata", "name": "Manyata Embassy Business Park", "address": "Outer Ring Rd, Nagavara, Bengaluru 560045", "lat": 13.0489, "lng": 77.6208, "type": "business_park"},
            {"id": "sd_jayanagar", "name": "Jayanagar 4th Block Shopping Complex", "address": "11th Main Rd, 4th Block, Jayanagar, Bengaluru 560011", "lat": 12.9298, "lng": 77.5834, "type": "shopping_mall"},
            {"id": "sd_cubbon", "name": "Cubbon Park Central Gate", "address": "Kasturba Rd, Sampangi Rama Nagara, Bengaluru 560001", "lat": 12.9763, "lng": 77.5929, "type": "park"},
            {"id": "sd_hsr", "name": "HSR Layout Sector 1 BDA Complex", "address": "27th Main Rd, Sector 1, HSR Layout, Bengaluru 560102", "lat": 12.9116, "lng": 77.6389, "type": "neighborhood"},
            {"id": "sd_hebbal", "name": "Hebbal Flyover Junction", "address": "Bellary Rd, Hebbal, Bengaluru 560024", "lat": 13.0358, "lng": 77.5970, "type": "intersection"},
            {"id": "sd_marathahalli", "name": "Marathahalli Bridge Junction", "address": "Old Airport Rd, Marathahalli, Bengaluru 560037", "lat": 12.9554, "lng": 77.6983, "type": "intersection"}
        ]

        matches = []
        for item in catalog:
            if query_lower in item["name"].lower() or query_lower in item["address"].lower():
                matches.append({
                    "place_id": item["id"],
                    "description": f"{item['name']}, {item['address']}",
                    "main_text": item["name"],
                    "secondary_text": item["address"],
                    "types": [item["type"]],
                    "latitude": item["lat"],
                    "longitude": item["lng"]
                })
        return matches[:8]

    def _local_place_details(self, place_id: str) -> Dict[str, Any]:
        catalog = self._local_places_autocomplete("")
        for item in [
            {"id": "sd_mg_road", "name": "MG Road Metro Station", "address": "Mahatma Gandhi Rd, Bengaluru, Karnataka 560001", "lat": 12.9756, "lng": 77.6066, "rating": 4.6},
            {"id": "sd_indiranagar", "name": "Indiranagar 100 Feet Road", "address": "100 Feet Rd, HAL 2nd Stage, Indiranagar, Bengaluru 560038", "lat": 12.9784, "lng": 77.6408, "rating": 4.7},
            {"id": "sd_koramangala", "name": "Koramangala 5th Block", "address": "80 Feet Rd, 5th Block, Koramangala, Bengaluru 560095", "lat": 12.9352, "lng": 77.6245, "rating": 4.8},
            {"id": "sd_whitefield", "name": "ITPB Whitefield Tech Park", "address": "ITPL Main Rd, Pattandur Agrahara, Whitefield, Bengaluru 560066", "lat": 12.9862, "lng": 77.7441, "rating": 4.5},
            {"id": "sd_airport", "name": "Kempegowda International Airport (BLR)", "address": "KIAL Rd, Devanahalli, Bengaluru, Karnataka 560300", "lat": 13.1986, "lng": 77.7066, "rating": 4.9},
            {"id": "sd_electronic_city", "name": "Electronic City Toll Gate Phase 1", "address": "Hosur Rd, Electronic City, Bengaluru 560100", "lat": 12.8452, "lng": 77.6602, "rating": 4.4},
            {"id": "sd_manyata", "name": "Manyata Embassy Business Park", "address": "Outer Ring Rd, Nagavara, Bengaluru 560045", "lat": 13.0489, "lng": 77.6208, "rating": 4.6},
            {"id": "sd_jayanagar", "name": "Jayanagar 4th Block Shopping Complex", "address": "11th Main Rd, 4th Block, Jayanagar, Bengaluru 560011", "lat": 12.9298, "lng": 77.5834, "rating": 4.5}
        ]:
            if item["id"] == place_id:
                return {
                    "place_id": item["id"],
                    "name": item["name"],
                    "formatted_address": item["address"],
                    "latitude": item["lat"],
                    "longitude": item["lng"],
                    "rating": item["rating"],
                    "types": ["point_of_interest"]
                }
        return {
            "place_id": place_id or "sd_default",
            "name": "Selected Destination",
            "formatted_address": "Bengaluru, Karnataka, India",
            "latitude": 12.9784,
            "longitude": 77.6408,
            "rating": 4.5,
            "types": ["geocode"]
        }

    def _local_reverse_geocode(self, lat: float, lng: float) -> Dict[str, Any]:
        landmarks = [
            ("MG Road, Shanthala Nagar, Ashok Nagar", 12.9756, 77.6066),
            ("100 Feet Rd, Indiranagar", 12.9784, 77.6408),
            ("Koramangala 5th Block, 80ft Road", 12.9352, 77.6245),
            ("Whitefield ITPL Main Road", 12.9862, 77.7441),
            ("Electronic City Phase 1, Hosur Road", 12.8452, 77.6602),
            ("Cubbon Park, Kasturba Road", 12.9763, 77.5929),
            ("Nagavara, Outer Ring Road", 13.0489, 77.6208)
        ]
        best_name = "Central Bengaluru, Karnataka"
        min_dist = float("inf")
        for name, llat, llng in landmarks:
            dist = haversine_distance_meters(lat, lng, llat, llng)
            if dist < min_dist:
                min_dist = dist
                best_name = f"{name} (near {round(dist)}m)"

        return {
            "formatted_address": f"{best_name}, Bengaluru, Karnataka 560001, India",
            "latitude": lat,
            "longitude": lng,
            "place_id": f"sd_rev_{round(lat, 4)}_{round(lng, 4)}"
        }

    def _local_nearby_search(
        self,
        lat: float,
        lng: float,
        mapped_type: str,
        radius_m: int
    ) -> List[Dict[str, Any]]:
        # High quality amenity dataset around Bengaluru urban centers
        amenities = [
            # Fuel / Petrol
            {"name": "Indian Oil Fuel Station — Auto Care", "type": "gas_station", "lat": 12.9720, "lng": 77.6010, "address": "Residency Rd, Shanthala Nagar", "rating": 4.4},
            {"name": "Bharat Petroleum (BPCL) — 24/7 Smart Fuel", "type": "gas_station", "lat": 12.9790, "lng": 77.6350, "address": "100 Feet Rd, Indiranagar", "rating": 4.5},
            {"name": "Shell Petrol & V-Power Station", "type": "gas_station", "lat": 12.9380, "lng": 77.6290, "address": "Koramangala 80ft Rd", "rating": 4.7},
            {"name": "HP Petrol Pump — Express Highway", "type": "gas_station", "lat": 12.9910, "lng": 77.7310, "address": "Whitefield Main Rd", "rating": 4.3},
            # EV Charging
            {"name": "Tata Power EZ Charge Fast Station", "type": "charging_station", "lat": 12.9745, "lng": 77.6080, "address": "Garuda Mall Basement 2, Magrath Rd", "rating": 4.8},
            {"name": "Ather Grid Fast EV Charger", "type": "charging_station", "lat": 12.9770, "lng": 77.6390, "address": "12th Main Rd, Indiranagar", "rating": 4.9},
            {"name": "Jio-bp pulse EV Charging Hub", "type": "charging_station", "lat": 12.9340, "lng": 77.6210, "address": "Sony World Junction, Koramangala", "rating": 4.6},
            # Hospitals
            {"name": "Manipal Hospital — 24/7 Trauma Emergency", "type": "hospital", "lat": 12.9592, "lng": 77.6534, "address": "HAL Old Airport Rd, Kodihalli", "rating": 4.7},
            {"name": "Fortis Hospital — Critical Care Center", "type": "hospital", "lat": 12.9810, "lng": 77.6050, "address": "Cunningham Rd, Vasanth Nagar", "rating": 4.6},
            {"name": "St. John's Medical College Hospital", "type": "hospital", "lat": 12.9312, "lng": 77.6195, "address": "Sarjapur Main Rd, Koramangala", "rating": 4.5},
            # Parking
            {"name": "SafePark Smart Multi-level Facility", "type": "parking", "lat": 12.9735, "lng": 77.6045, "address": "Brigade Rd Crossing, Ashok Nagar", "rating": 4.3},
            {"name": "Indiranagar Metro Public Parking", "type": "parking", "lat": 12.9780, "lng": 77.6385, "address": "CMH Rd, Indiranagar", "rating": 4.2},
            # Car & Bike Repair
            {"name": "Bosch Car Service & SafeDrive Mechanic Hub", "type": "car_repair", "lat": 12.9760, "lng": 77.6150, "address": "Richmond Rd, Victoria Layout", "rating": 4.6},
            {"name": "SpeedWheels 2-Wheeler & 4-Wheeler Service", "type": "car_repair", "lat": 12.9795, "lng": 77.6420, "address": "Indiranagar Double Rd", "rating": 4.7}
        ]

        filtered = []
        for a in amenities:
            if a["type"] == mapped_type or mapped_type == "gas_station" and a["type"] in ["gas_station", "charging_station"]:
                dist = haversine_distance_meters(lat, lng, a["lat"], a["lng"])
                filtered.append({
                    "place_id": f"sd_poi_{a['type']}_{round(a['lat'], 3)}",
                    "name": a["name"],
                    "category": a["type"],
                    "address": a["address"],
                    "latitude": a["lat"],
                    "longitude": a["lng"],
                    "distance_km": round(dist / 1000.0, 2),
                    "rating": a["rating"],
                    "open_now": True
                })

        filtered.sort(key=lambda x: x["distance_km"])
        return filtered[:10]


# Global singleton instance
google_maps_service = GoogleMapsService()
