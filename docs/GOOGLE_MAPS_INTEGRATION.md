# SafeDrive AI — Production Google Maps Navigation & Driver Safety Intelligence

## 1. Executive Summary & Architecture

SafeDrive AI integrates **Google Maps Platform** services with proprietary **Edge AI Driver Safety Intelligence**. Rather than relying on simple static routing or simulated maps, SafeDrive AI implements a multi-tiered geospatial navigation architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SafeDrive AI Navigation System                  │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Mobile & Web Frontends                                              │
│    • Flutter Mobile App: Native Vector Google Maps (`google_maps_flutter`)│
│    • React Web Caretaker Dashboard: Google Maps JavaScript API (v3)    │
│    • Real-time GPS Heading Follow, 3D Camera Tilt (45°), Spoken TTS   │
├────────────────────────────────────────────────────────────────────────┤
│ 2. Backend Geospatial Gateway (FastAPI)                                │
│    • Google Routes API / Directions API (Two-Wheeler, Drive, Truck)    │
│    • Google Places API (Autocomplete & Details Proxy)                  │
│    • Geocoding & Reverse Geocoding Engine                              │
│    • High-Precision Offline / Zero-Config Fallback Engine              │
├────────────────────────────────────────────────────────────────────────┤
│ 3. SafeDrive AI Safety Intelligence Scoring Layer                      │
│    • Formula: route_cost = travel_time + w1·hazard + w2·zone           │
│                           + w3·traffic + w4·hotspot + w5·weather       │
│    • Multi-Vehicle Profiles: Bike/Scooter, Car/Taxi, Truck, Bus        │
│    • Dynamic Rerouting (>50m off-track), School Zone Speed Enforcer    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Required Google Maps Platform APIs and SDKs

To operate in live cloud mode, enable the following APIs in the **Google Cloud Console**:

| API / SDK Name | Usage in SafeDrive AI | Recommended Restriction |
| :--- | :--- | :--- |
| **Routes API** / **Directions API** | Computing traffic-aware routes, two-wheeler mode, alternative candidate routes | IP Address (Backend server IP) |
| **Places API (New)** | Real-time destination autocomplete search and place details lookup | IP Address (Backend server IP) |
| **Geocoding API** | Reverse geocoding GPS coordinates to street addresses | IP Address (Backend server IP) |
| **Maps SDK for Android** | Interactive vector Google Map in Flutter mobile application | Android Package Name + SHA-1 Fingerprint |
| **Maps JavaScript API** | Live fleet tracking and route replay in React web dashboard | HTTP Referrer (`localhost:5173/*`, production domain) |

> [!NOTE]
> **Google Navigation SDK Note**: Full in-app Google Navigation SDK (turn-by-turn vector engine) is restricted by Google to enterprise Mobility / Rides & Deliveries partners under custom pricing. SafeDrive AI implements the official supported production architecture: **Maps SDK for Android** paired with the **Routes API**, client-side dead reckoning, compass heading synchronization, and `flutter_tts` spoken turn-by-turn guidance.

---

## 3. Environment Variables & Key Restrictions

### Server Environment (`.env`)
```bash
# Server-side API key for Routes, Places, Geocoding
GOOGLE_MAPS_SERVER_API_KEY="AIzaSyYourServerKeyHere"

# Client-side API key for mobile SDKs & web dashboard
GOOGLE_MAPS_CLIENT_API_KEY="AIzaSyYourRestrictedClientKeyHere"

# Enable Google Maps Platform services (True = Live Google Cloud; False = SafeDrive Native Engine)
ENABLE_GOOGLE_MAPS=True
```

### Security & Key Restrictions
1. **Never use an unrestricted API key in production**:
   - Create two separate API keys in the Google Cloud Console.
2. **Server Key (`GOOGLE_MAPS_SERVER_API_KEY`)**:
   - Set **API restrictions**: Select only *Routes API*, *Directions API*, *Places API*, and *Geocoding API*.
   - Set **Application restrictions**: Restrict to *IP addresses* (your backend server's public IP).
3. **Android Client Key (`GOOGLE_MAPS_CLIENT_API_KEY`)**:
   - Set **API restrictions**: Select only *Maps SDK for Android*.
   - Set **Application restrictions**: Restrict to *Android apps*:
     - Package name: `com.safedrive.ai.safedrive_app`
     - SHA-1 certificate fingerprint:
       - Debug: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`
4. **Web Client Key**:
   - Set **API restrictions**: Select only *Maps JavaScript API*.
   - Set **Application restrictions**: Restrict to *Websites / HTTP referrers* (e.g. `http://localhost:5173/*`).

---

## 4. Setup Instructions

### Android Setup
1. Open `mobile_app/android/app/src/main/AndroidManifest.xml`.
2. Ensure `<meta-data android:name="com.google.android.geo.API_KEY" android:value="..." />` contains your client key.
3. Permissions for location and foreground tracking are already configured:
   - `android.permission.ACCESS_FINE_LOCATION`
   - `android.permission.ACCESS_COARSE_LOCATION`
   - `android.permission.ACCESS_BACKGROUND_LOCATION`
   - `android.permission.FOREGROUND_SERVICE`
4. Compile the application:
   ```powershell
   cd mobile_app
   flutter pub get
   flutter build apk --debug
   ```

### Web Setup (React + Vite)
1. In `web/index.html`, the Google Maps script loader connects to `/api/v1/routes/config` and loads the client key dynamically.
2. Run the web dev server:
   ```powershell
   cd web
   npm run dev
   ```

### iOS Setup (When deploying to Apple devices)
1. Add to `ios/Runner/AppDelegate.swift`:
   ```swift
   import GoogleMaps
   GMSServices.provideAPIKey("YOUR_IOS_CLIENT_API_KEY")
   ```
2. Add location privacy descriptions to `ios/Runner/Info.plist`:
   - `NSLocationWhenInUseUsageDescription`
   - `NSLocationAlwaysAndWhenInUseUsageDescription`

---

## 5. Multi-Vehicle Profiles & Safety Scoring

SafeDrive AI adapts both route geometry and driving thresholds based on the active vehicle:

| Vehicle Profile | Routing Mode | Pothole Penalty Multiplier | Speed Alert Threshold | Dimension/Weight Constraints |
| :--- | :--- | :--- | :--- | :--- |
| **Motorcycle / Scooter** | `TWO_WHEELER` (India/Asia) / Avoid Highways | **1.6×** (High hazard severity) | 60 km/h | Avoids expressways where 2-wheelers are prohibited |
| **Car / Taxi** | `DRIVE` (Standard) | **1.0×** (Normal) | 80 km/h | Standard passenger clearance |
| **Truck** | `DRIVE` with Dimension Filters | **1.2×** (Road condition) | 60 km/h | Bridge height (e.g., 3.8m), gross weight (16t) |
| **Bus** | `DRIVE` | **1.1×** | 60 km/h | Passenger comfort, turning radius consideration |
| **Mixed Fleet** | Dynamic per-vehicle tracking | Per assigned profile | Per vehicle type | Centralized caretaker monitoring |

### SafeDrive Risk Scoring Formula
The safety score ($0-100$) is calculated independently of Google's ETA:
$$\text{route\_cost} = \text{base\_time} + w_1\cdot \text{hazards} + w_2\cdot \text{zones} + w_3\cdot \text{traffic} + w_4\cdot \text{hotspots} + w_5\cdot \text{weather}$$
$$\text{safety\_score} = \max\left(10, 100 - \frac{\text{route\_cost} - \text{base\_time}}{1.5}\right)$$

The route with the highest safety score is tagged **SafeDrive Recommended**, while the fastest is clearly labeled **Fastest Route** with transparent reason tags.

---

## 6. Billing, Free Tier & Quotas

- **$200 Monthly Free Credit**: Google Cloud provides a recurring monthly credit of $200 USD for Google Maps Platform, covering roughly:
  - ~28,000 Directions requests
  - ~70,000 Places Autocomplete queries
  - Unlimited dynamic map loads on mobile SDKs (Android & iOS)
- **Zero-Cost Local Fallback**: When `ENABLE_GOOGLE_MAPS=False` or when offline, SafeDrive AI automatically switches to its local high-precision route engine, ensuring zero unexpected cloud charges during local development or academic evaluation.
- **Budget Alerts**: Set a budget alert at $10 (5% threshold) in Google Cloud Billing to prevent accidental overages.

---

## 7. Verification & Test Summary

All automated integration test suites executed with **100% pass rate**:
- `tests/test_google_maps_integration.py` (8/8 passed):
  - `test_google_maps_config_endpoint` [PASSED]
  - `test_places_autocomplete` [PASSED]
  - `test_place_details` [PASSED]
  - `test_reverse_geocode` [PASSED]
  - `test_nearby_amenities` [PASSED]
  - `test_safe_directions_with_vehicle_profiles` [PASSED]
  - `test_multi_stop_plan` [PASSED]
  - `test_google_polyline_decoder` [PASSED]
- Full Regression Test Suite (`pytest tests/ -k "not test_phase1"`): **34/34 passed**
- Web Dashboard (`npm run build`): **1,954 modules transformed, built in 5.95s, 0 errors**
- Flutter Static Analysis (`flutter analyze`): **0 compilation errors**
