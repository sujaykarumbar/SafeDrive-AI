# SafeDrive AI — Datasets & Data Governance

## Overview
This directory stores datasets, feature extracts, and proxy labels used for training and testing SafeDrive AI.

## Datasets
1. **RDD2022 (Road Damage Dataset 2022)**:
   - Used for road surface anomalies (potholes, longitudinal cracks, alligator cracking).
2. **Hazard Real-World Supplements**:
   - Augmented images for fallen trees, severe monsoon waterlogging, and accident debris.
3. **Trip Telemetry**:
   - Simulated & test trip logs in Bengaluru corridors with speed profiles, GPS waypoints, and sensor deceleration measurements.

## Privacy & Safety Principles
- No personal identifiable faces or vehicle license plates are stored unblurred.
- Driver front-camera video is processed strictly on-device; raw video is never uploaded or persisted.
- Demo data is strictly segregated from real operational data.
