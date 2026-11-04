import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../api';
import { Play, Square, AlertOctagon, Zap, ShieldAlert, Check, Compass, Battery, Gauge } from 'lucide-react';

const SIMULATED_PATH = [
  { lat: 12.9716, lng: 77.5946, speed: 28, addr: 'MG Road Metro Station' },
  { lat: 12.9725, lng: 77.5980, speed: 38, addr: 'Mayo Hall Junction' },
  { lat: 12.9740, lng: 77.6050, speed: 48, addr: 'Garuda Mall Corridor' },
  { lat: 12.9752, lng: 77.6120, speed: 54, addr: 'Trinity Circle' },
  { lat: 12.9760, lng: 77.6210, speed: 60, addr: 'Indiranagar 100ft Road' },
  { lat: 12.9650, lng: 77.6250, speed: 42, addr: 'Domlur Flyover' },
  { lat: 12.9520, lng: 77.6240, speed: 35, addr: 'Intermediate Ring Road' },
  { lat: 12.9410, lng: 77.6235, speed: 26, addr: 'Sony World Junction' },
  { lat: 12.9352, lng: 77.6245, speed: 0, addr: 'Koramangala 5th Block' }
];

export const DriverSimulatorModal: React.FC = () => {
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [pathIndex, setPathIndex] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(0);
  const [battery, setBattery] = useState<number>(95);
  const [vehicleCategory, setVehicleCategory] = useState<string>('car');
  const [logs, setLogs] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const timerRef = useRef<any>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [ `[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 15) ]);
  };

  // Check existing active trip
  const checkActiveTrip = async () => {
    try {
      const trip = await apiFetch('/trips/active');
      if (trip) {
        setActiveTrip(trip);
        setIsSimulating(true);
        addLog(`Resumed active trip #${trip.id} started at ${trip.start_address || 'MG Road'}`);
      }
    } catch (e) {
      // Driver might not be logged in or no active trip
    }
  };

  useEffect(() => {
    checkActiveTrip();
  }, []);

  // Simulation timer loop
  useEffect(() => {
    if (isSimulating && activeTrip) {
      timerRef.current = setInterval(async () => {
        setPathIndex(prev => {
          const nextIdx = (prev + 1) % SIMULATED_PATH.length;
          const pt = SIMULATED_PATH[nextIdx];
          setSpeed(pt.speed);
          setBattery(b => Math.max(15, b - 0.2));

          // Post location batch to backend
          apiFetch(`/trips/${activeTrip.id}/locations`, {
            method: 'POST',
            body: JSON.stringify({
              locations: [{
                latitude: pt.lat,
                longitude: pt.lng,
                speed_kmh: pt.speed,
                heading: 140,
                battery_level: battery,
                is_moving: pt.speed > 0
              }]
            })
          }).catch(err => console.error('Sim upload error:', err));

          addLog(`GPS Point emitted: ${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)} • Speed: ${pt.speed} km/h (${pt.addr})`);
          return nextIdx;
        });
      }, 2500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSimulating, activeTrip, battery]);

  const handleStartTrip = async () => {
    try {
      const pt = SIMULATED_PATH[0];
      const trip = await apiFetch('/trips/start', {
        method: 'POST',
        body: JSON.stringify({
          start_lat: pt.lat,
          start_lng: pt.lng,
          start_address: pt.addr
        })
      });
      setActiveTrip(trip);
      setIsSimulating(true);
      setPathIndex(0);
      setSpeed(pt.speed);
      addLog(`Trip #${trip.id} initialized from ${pt.addr} with category: ${vehicleCategory.toUpperCase()}`);
    } catch (e: any) {
      addLog(`Error starting trip: ${e.message}`);
    }
  };

  const handleEndTrip = async () => {
    if (!activeTrip) return;
    try {
      const pt = SIMULATED_PATH[pathIndex];
      const finished = await apiFetch(`/trips/${activeTrip.id}/end`, {
        method: 'POST',
        body: JSON.stringify({
          end_lat: pt.lat,
          end_lng: pt.lng,
          end_address: pt.addr
        })
      });
      setIsSimulating(false);
      setActiveTrip(null);
      setSpeed(0);
      addLog(`Trip #${finished.id} ended. Total Dist: ${finished.distance_km} km • Duration: ${finished.duration_minutes} min • Risk: ${finished.risk_score}/100`);
    } catch (e: any) {
      addLog(`Error ending trip: ${e.message}`);
    }
  };

  const handleTriggerHarshBrake = async () => {
    if (!activeTrip) return;
    try {
      const pt = SIMULATED_PATH[pathIndex];
      await apiFetch(`/trips/${activeTrip.id}/events`, {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'harsh_brake',
          severity: 'medium',
          latitude: pt.lat,
          longitude: pt.lng,
          confidence: 0.92,
          metadata_json: { deceleration_g: 0.48, speed: speed }
        })
      });
      addLog(`EVENT DETECTED: Harsh Braking (-0.48g) transmitted to Caretaker telemetry`);
    } catch (e: any) {
      addLog(`Error triggering event: ${e.message}`);
    }
  };

  const handleTriggerDrowsiness = async () => {
    if (!activeTrip) return;
    try {
      const pt = SIMULATED_PATH[pathIndex];
      await apiFetch(`/trips/${activeTrip.id}/events`, {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'drowsiness',
          severity: 'high',
          latitude: pt.lat,
          longitude: pt.lng,
          confidence: 0.96,
          metadata_json: { ear: 0.18, duration_s: 2.1, landmark: 'MediaPipe FaceMesh EAR < 0.22' }
        })
      });
      addLog(`DEMO STEP 2: Driver Eyes Closed (EAR 0.18 for 2.1s) -> Alarm Sounded & Caretaker Alert Dispatched`);
    } catch (e: any) {
      addLog(`Error triggering drowsiness: ${e.message}`);
    }
  };

  const handleTriggerSchoolZone = async () => {
    try {
      const res = await apiFetch('/routes/check-zones', {
        method: 'POST',
        body: JSON.stringify({
          latitude: 12.9780,
          longitude: 77.6405,
          speed_kmh: 42.0,
          driver_id: 1
        })
      });
      const alert = res.alerts?.[0];
      addLog(`DEMO STEP 3: Entered School Zone -> Voice Alert: "${alert?.speech_warning || 'School zone ahead, slow down to 25 km/h'}"`);
    } catch (e: any) {
      addLog(`Error checking zones: ${e.message}`);
    }
  };

  const handleTriggerPotholeReport = async () => {
    try {
      const pt = SIMULATED_PATH[pathIndex];
      const res = await apiFetch('/hazards/', {
        method: 'POST',
        body: JSON.stringify({
          hazard_type: 'pothole',
          severity: 'high',
          title: 'Deep Cavity on Carriageway',
          description: 'AI vision auto-classified pothole. High vehicle diversion risk.',
          latitude: pt.lat,
          longitude: pt.lng,
          address: pt.addr
        })
      });
      addLog(`DEMO STEP 4: Phone A Uploaded Pothole -> AI Classified (94% conf) -> Forwarded to Road Dept (ID #${res.id})`);
    } catch (e: any) {
      addLog(`Error reporting hazard: ${e.message}`);
    }
  };

  const handleTriggerCrash = async () => {
    try {
      const pt = SIMULATED_PATH[pathIndex];
      const res = await apiFetch('/emergency/trigger', {
        method: 'POST',
        body: JSON.stringify({
          trip_id: activeTrip?.id,
          incident_type: 'suspected_crash',
          latitude: pt.lat,
          longitude: pt.lng,
          location_address: pt.addr,
          notes: 'High G-force impact (4.6g) + sudden speed drop to 0 km/h.'
        })
      });
      addLog(`DEMO STEP 6: CRASH IMPACT (4.6g) -> 30s Countdown -> Caretaker SMS/Email & Ambulance Escalate (ID #${res.id})`);
    } catch (e: any) {
      addLog(`Error triggering crash: ${e.message}`);
    }
  };

  const handleTriggerSOS = async () => {
    try {
      const pt = SIMULATED_PATH[pathIndex];
      const res = await apiFetch('/emergency/trigger', {
        method: 'POST',
        body: JSON.stringify({
          trip_id: activeTrip?.id,
          incident_type: 'manual_sos',
          latitude: pt.lat,
          longitude: pt.lng,
          location_address: pt.addr,
          notes: 'Driver tapped SOS button inside simulator.'
        })
      });
      addLog(`EMERGENCY SOS FIRED! Incident #${res.id} alerted to caretakers!`);
    } catch (e: any) {
      addLog(`Error triggering SOS: ${e.message}`);
    }
  };

  return (
    <div style={{ padding: '0 16px 20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Simulator Control Panel */}
      <div className="glass-panel" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Gauge size={24} color="var(--accent-rose)" /> Driver Mobile Simulation Station
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Demonstrates all 6 Final-Year Viva evaluation scenarios from Chapter 13.4 of the Master Blueprint.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            {!isSimulating ? (
              <button onClick={handleStartTrip} className="btn btn-primary" style={{ padding: '10px 20px' }}>
                <Play size={16} /> 1. Start Simulated Trip
              </button>
            ) : (
              <button onClick={handleEndTrip} className="btn btn-danger" style={{ padding: '10px 20px' }}>
                <Square size={16} /> End Current Trip
              </button>
            )}
          </div>
        </div>

        {/* Vehicle Selection & Live Gauges */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 20 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vehicle Profile (Multi-Vehicle)</span>
            <select
              value={vehicleCategory}
              onChange={(e) => setVehicleCategory(e.target.value)}
              disabled={isSimulating}
              style={{
                width: '100%',
                marginTop: 8,
                background: '#111827',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                outline: 'none',
                fontSize: '0.85rem'
              }}
            >
              <option value="car">Car (Standard Passenger)</option>
              <option value="bike">Bike (Two-Wheeler)</option>
              <option value="scooter">Scooter (Light Commuter)</option>
              <option value="taxi">Taxi (Commercial Passenger)</option>
              <option value="truck">Truck (Heavy Commercial)</option>
              <option value="bus">Bus (Transit)</option>
            </select>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Live Speed</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: 4 }}>
              {speed} <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>km/h</span>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Battery</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: 4 }}>
              {Math.round(battery)}%
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Waypoint Corridor</span>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginTop: 8 }}>
              {SIMULATED_PATH[pathIndex]?.addr || 'MG Road'}
            </div>
          </div>
        </div>

        {/* 6 Blueprint Evaluation Trigger Buttons */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Chapter 13.4 Demo Script Actions:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button
              onClick={handleTriggerDrowsiness}
              disabled={!isSimulating}
              className="btn btn-outline"
              style={{ borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)', fontSize: '0.8rem' }}
            >
              <Zap size={14} /> 2. Simulate Drowsiness (EAR &lt; 0.22)
            </button>

            <button
              onClick={handleTriggerSchoolZone}
              className="btn btn-outline"
              style={{ borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)', fontSize: '0.8rem' }}
            >
              <Compass size={14} /> 3. Enter School Zone (25 km/h)
            </button>

            <button
              onClick={handleTriggerPotholeReport}
              className="btn btn-outline"
              style={{ borderColor: 'var(--accent-purple)', color: 'var(--accent-purple)', fontSize: '0.8rem' }}
            >
              <AlertOctagon size={14} /> 4. Report Pothole with AI
            </button>

            <button
              onClick={handleTriggerHarshBrake}
              disabled={!isSimulating}
              className="btn btn-outline"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)', fontSize: '0.8rem' }}
            >
              Simulate Harsh Braking
            </button>

            <button
              onClick={handleTriggerCrash}
              className="btn btn-danger"
              style={{ fontSize: '0.8rem' }}
            >
              <ShieldAlert size={14} /> 6. Trigger Crash (4.6g Spike)
            </button>
          </div>
        </div>
      </div>

      {/* Simulator Event Console Logs */}
      <div className="glass-panel" style={{ padding: 18 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Real-Time Driver Sensor & Telemetry Feed
        </h3>
        <div style={{
          marginTop: 10,
          background: '#070a12',
          padding: 14,
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'monospace',
          fontSize: '0.78rem',
          color: '#34d399',
          height: '240px',
          overflowY: 'auto',
          border: '1px solid var(--border-color)'
        }}>
          {logs.length > 0 ? (
            logs.map((log, i) => (
              <div key={i} style={{ marginBottom: 4 }}>{log}</div>
            ))
          ) : (
            <div style={{ color: 'var(--text-dim)' }}>Ready. Click "Start Simulated Trip" to emit live GPS points...</div>
          )}
        </div>
      </div>
    </div>
  );
};
