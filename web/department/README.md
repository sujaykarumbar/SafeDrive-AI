# SafeDrive AI — Road Department Operations Panel

## Overview
A dedicated workflow panel for municipal road officers, highway maintenance authorities, and emergency taskforces to manage driver-reported road hazards.

## Features
- **Prioritised Hazard Queue**: Sorted by critical urgency and confirmation count.
- **Workflow State Machine**: `reported` → `forwarded` → `assigned` → `in_progress` → `fixed` (verified with proof photo).
- **Audit Logging**: Every status transition records officer ID, notes, and timestamps.
- **Operational Metrics**: Counters for Open, Assigned, In Progress, and Fixed issues with average resolution time.

## Running Locally
In the `web/` directory:
```bash
npm install
npm run dev
```
Select "Road Dept Portal".
Demo Account: `officer.kumar@safedrive.ai` (Password: `SafeDrive@2026`)
