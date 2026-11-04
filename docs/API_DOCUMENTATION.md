# SafeDrive AI — API Documentation & Contract Specification

All endpoints are prefixed with `/api/v1` and document standard OpenAPI specifications available interactively at `/docs`.

## 1. Authentication (`/auth`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Register new user (driver, caretaker, officer, admin) | No |
| `POST` | `/auth/login` | Login with email and password, returns JWT | No |
| `POST` | `/auth/token` | OAuth2 form login for Swagger UI | No |
| `GET` | `/auth/me` | Fetch authenticated user profile | Bearer JWT |
| `POST` | `/auth/logout` | Log user out and write audit entry | Bearer JWT |

---

## 2. Vehicles & Profiles (`/vehicles`)

| Method | Endpoint | Description | Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/vehicles/categories` | List 6 vehicle categories and reviewed profiles | Public / Any |
| `GET` | `/vehicles/` | List logged-in driver's registered vehicles | Driver |
| `POST` | `/vehicles/` | Add vehicle (category, make, model, reg, subtype) | Driver |
| `PUT` | `/vehicles/{id}/default` | Set active default vehicle | Driver |
| `DELETE`| `/vehicles/{id}` | Delete vehicle from garage | Driver |

---

## 3. Trips & Telemetry (`/trips`)

| Method | Endpoint | Description | Roles |
| :--- | :--- | :--- | :--- |
| `POST` | `/trips/start` | Start an active trip session | Driver |
| `POST` | `/trips/{id}/end` | End trip, calculate distance, duration & score | Driver |
| `POST` | `/trips/{id}/locations`| Batch upload GPS coordinates (emits WS telemetry) | Driver |
| `POST` | `/trips/{id}/events` | Record detected event (harsh brake, overspeed, etc.)| Driver |
| `GET` | `/trips/active` | Get current ongoing trip | Driver |
| `GET` | `/trips/history` | List driver's past completed trips | Driver |
| `GET` | `/trips/{id}` | Single trip details | Driver / Caretaker |
| `GET` | `/trips/{id}/replay` | GPS trajectory & events for map playback | Driver / Caretaker |

---

## 4. Caretaker Monitoring (`/caretaker`)

| Method | Endpoint | Description | Roles |
| :--- | :--- | :--- | :--- |
| `POST` | `/caretaker/invite` | Driver generates 6-character linking code | Driver |
| `POST` | `/caretaker/link-by-code` | Caretaker links with driver using code | Caretaker |
| `GET` | `/caretaker/monitored-drivers`| List authorized drivers with live status | Caretaker |
| `GET` | `/caretaker/drivers/{id}/live` | Live location of specific linked driver | Caretaker (Consent-Checked) |
| `GET` | `/caretaker/drivers/{id}/trips`| Historic trips for linked driver | Caretaker |
| `GET` | `/caretaker/drivers/{id}/risk-summary`| Explainable risk factors & 7-day stats | Caretaker |

---

## 5. Road Hazards (`/hazards`)

| Method | Endpoint | Description | Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/hazards/` | List hazards with filters (status, severity, type) | Any |
| `POST` | `/hazards/` | Submit road hazard report with photo | Driver / Any |
| `POST` | `/hazards/{id}/vote` | Vote "still_there" or "fixed" | Any |
| `PATCH`| `/hazards/{id}/status` | Officer updates status (assigned, in_progress, fixed) | Officer / Admin |

---

## 6. Emergency & SOS (`/emergency`)

| Method | Endpoint | Description | Roles |
| :--- | :--- | :--- | :--- |
| `POST` | `/emergency/trigger` | Trigger manual SOS or crash alert | Driver |
| `POST` | `/emergency/{id}/cancel` | Cancel during 30s countdown window | Driver |
| `POST` | `/emergency/{id}/acknowledge`| Caretaker or Officer acknowledges alert | Caretaker / Officer |
| `GET` | `/emergency/active` | List open emergencies | Caretaker / Officer / Admin |

---

## 7. WebSockets (`/ws`)

| Path | Protocol | Purpose | Auth |
| :--- | :--- | :--- | :--- |
| `/ws/driver/telemetry?token=...` | WS | Real-time GPS stream from driver phone | Driver JWT |
| `/ws/caretaker/driver/{driver_id}?token=...` | WS | Live telemetry subscription for caretaker | Caretaker JWT (Consent Enforced) |
