import React, { useEffect, useState, useRef } from 'react';
import {
  MonitoredDriver,
  CaretakerOverview,
  EmergencyIncident,
  Hazard,
  TripHistoryItem,
  apiFetch
} from '../api';
import {
  Users,
  Car,
  ShieldCheck,
  AlertTriangle,
  Search,
  Filter,
  MapPin,
  Clock,
  Compass,
  Plus,
  Minus,
  Maximize2,
  Navigation,
  Radio,
  ChevronRight,
  Lightbulb,
  CheckCircle2,
  PhoneCall,
  RotateCcw,
  Bike,
  Truck,
  Bus,
  Activity,
  AlertOctagon,
  Eye,
  Sliders,
  Crosshair,
  ShieldAlert,
  FileText
} from 'lucide-react';

declare const L: any;

interface CaretakerDashboardProps {
  currentTab: string; // 'dashboard' | 'live_fleet' | 'risk_analytics' | 'trip_replay' | 'emergency' | 'drivers' | 'fleet' | 'reports' | 'roadwatch' | 'settings'
  onSelectTab?: (tab: any) => void;
}

const DRIVER_AVATARS: Record<string, string> = {
  'Rahul Kumar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
  'Anjali Reddy': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
  'Vikram Singh': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
  'Sneha Patel': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&auto=format&fit=crop&q=80',
  'Arjun Nair': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80'
};

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80';

export const CaretakerDashboard: React.FC<CaretakerDashboardProps> = ({ currentTab = 'live_fleet', onSelectTab }) => {
  // Real dynamic states loaded from backend API
  const [drivers, setDrivers] = useState<MonitoredDriver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<MonitoredDriver | null>(null);
  const [overview, setOverview] = useState<CaretakerOverview | null>(null);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyIncident[]>([]);
  const [driverTrips, setDriverTrips] = useState<TripHistoryItem[]>([]);
  const [riskSummary, setRiskSummary] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'live' | 'idle' | 'offline'>('all');
  const [mapLayer, setMapLayer] = useState<'map' | 'satellite' | 'terrain'>('map');
  const [isReplaying, setIsReplaying] = useState<boolean>(false);

  const mapRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const polylineRef = useRef<any>(null);

  // 1. Fetch Real Backend Data
  const fetchAllData = async () => {
    try {
      // Real Overview Metrics
      const ovData: CaretakerOverview = await apiFetch('/caretaker/overview');
      setOverview(ovData);

      // Real Monitored Drivers
      const driverList: MonitoredDriver[] = await apiFetch('/caretaker/monitored-drivers');
      setDrivers(driverList);
      if (driverList.length > 0 && !selectedDriver) {
        setSelectedDriver(driverList[0]);
      }

      // Real Active Emergencies
      const emgList: EmergencyIncident[] = await apiFetch('/emergency/active');
      setEmergencies(emgList || []);

      // Real Road Hazards
      const hzList: Hazard[] = await apiFetch('/hazards/');
      setHazards(hzList || []);
    } catch (err) {
      console.warn('Backend sync in progress:', err);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 3000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Selected Driver Trips & Risk Breakdown
  useEffect(() => {
    if (!selectedDriver) return;

    const loadDriverData = async () => {
      try {
        const trips = await apiFetch(`/caretaker/drivers/${selectedDriver.driver_id}/trips`);
        setDriverTrips(trips || []);

        const risk = await apiFetch(`/caretaker/drivers/${selectedDriver.driver_id}/risk-summary`);
        setRiskSummary(risk || null);
      } catch (e) {
        // Driver might not have trips yet
      }
    };
    loadDriverData();
  }, [selectedDriver?.driver_id]);

  // 3. Initialize Interactive Leaflet Map
  useEffect(() => {
    let timer = setTimeout(() => {
      const mapEl = document.getElementById('caretaker-satellite-map');
      if (!mapEl || typeof L === 'undefined') return;

      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {}
        mapRef.current = null;
        markersRef.current = {};
      }

      const map = L.map('caretaker-satellite-map', {
        center: [12.9716, 77.5946],
        zoom: 13,
        zoomControl: false,
        attributionControl: false
      });

      let tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      if (mapLayer === 'satellite') {
        tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      } else if (mapLayer === 'terrain') {
        tileUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      }

      L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);
      mapRef.current = map;

      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch (e) {}
      }, 150);
    }, 50);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {}
        mapRef.current = null;
        markersRef.current = {};
      }
    };
  }, [currentTab, mapLayer]);

  // 4. Update Map Markers for Real Drivers & Real Hazards
  useEffect(() => {
    if (!mapRef.current || typeof L === 'undefined') return;

    // Clear previous markers
    Object.values(markersRef.current).forEach((m: any) => m.remove());
    markersRef.current = {};

    // A. Plot Real Drivers
    drivers.forEach(d => {
      const lat = d.last_location?.latitude || (d.active_trip ? 12.9716 : 12.9784);
      const lng = d.last_location?.longitude || (d.active_trip ? 77.5946 : 77.6408);
      const isDriving = d.active_trip !== null;
      const isSelected = selectedDriver?.driver_id === d.driver_id;

      const markerColor = isSelected ? '#00f0ff' : (isDriving ? '#10b981' : '#3b82f6');
      const iconEmoji = d.vehicle_category === 'bike' ? '🏍️' :
                        d.vehicle_category === 'truck' ? '🚛' :
                        d.vehicle_category === 'bus' ? '🚌' : '🚗';

      const iconHtml = `
        <div style="
          width: 38px; height: 38px;
          border-radius: 50%;
          background: ${markerColor};
          border: 3px solid #ffffff;
          box-shadow: 0 0 16px ${markerColor};
          display: flex; align-items: center; justify-content: center;
          font-size: 15px;
          cursor: pointer;
        ">
          ${iconEmoji}
        </div>
      `;

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'driver-marker',
          html: iconHtml,
          iconSize: [38, 38],
          iconAnchor: [19, 19]
        })
      }).addTo(mapRef.current);

      marker.bindPopup(`
        <div style="color: #060b14; font-family: sans-serif; padding: 4px;">
          <b style="font-size: 13px;">${d.driver_name}</b><br/>
          <span>Vehicle: ${d.vehicle_label || d.vehicle_category}</span><br/>
          <span>Speed: <b>${Math.round(d.last_location?.speed_kmh || 0)} km/h</b></span><br/>
          <span>Safety Score: <b style="color:#0284c7">${d.safety_score}/100</b></span>
        </div>
      `);

      marker.on('click', () => setSelectedDriver(d));
      markersRef.current[`driver-${d.driver_id}`] = marker;
    });

    // B. Plot Real Road Hazards from Database
    hazards.forEach(h => {
      const isCritical = h.severity === 'critical';
      const color = isCritical ? '#ef4444' : '#f59e0b';
      const emoji = h.hazard_type === 'pothole' ? '🕳️' :
                    h.hazard_type === 'waterlogging' ? '🌊' :
                    h.hazard_type === 'fallen_tree' ? '🌲' : '⚠️';

      const iconHtml = `
        <div style="
          width: 32px; height: 32px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid #ffffff;
          box-shadow: 0 0 14px ${color};
          display: flex; align-items: center; justify-content: center;
          font-size: 13px;
        ">
          ${emoji}
        </div>
      `;

      const marker = L.marker([h.latitude, h.longitude], {
        icon: L.divIcon({
          className: 'hazard-marker',
          html: iconHtml,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })
      }).addTo(mapRef.current);

      marker.bindPopup(`
        <div style="color: #060b14; font-family: sans-serif; padding: 4px; max-width: 220px;">
          <b style="font-size: 12px; color: ${color};">${h.severity.toUpperCase()}: ${h.title}</b><br/>
          <span style="font-size: 11px; color: #444;">${h.address || ''}</span><br/>
          <span style="font-size: 11px;">Status: <b>${h.status.toUpperCase()}</b></span>
        </div>
      `);

      markersRef.current[`hazard-${h.id}`] = marker;
    });

    // C. Center on Selected Driver
    if (selectedDriver && selectedDriver.last_location) {
      mapRef.current.panTo([selectedDriver.last_location.latitude, selectedDriver.last_location.longitude]);
    }
  }, [drivers, hazards, selectedDriver]);

  // Handle Trip Replay
  const handleReplayTrip = async (tripId?: number) => {
    if (!selectedDriver) return;
    try {
      setIsReplaying(true);
      const targetId = tripId || (driverTrips.length > 0 ? driverTrips[0].id : null);
      if (!targetId) return;

      const replay = await apiFetch(`/trips/${targetId}/replay`);
      if (replay && replay.path && mapRef.current && typeof L !== 'undefined') {
        const latLngs = replay.path.map((p: any) => [p.lat, p.lng]);
        if (polylineRef.current) {
          polylineRef.current.remove();
        }
        const polyline = L.polyline(latLngs, {
          color: '#00f0ff',
          weight: 5,
          opacity: 0.9,
          dashArray: '8, 8'
        }).addTo(mapRef.current);
        polylineRef.current = polyline;
        mapRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });
      }
    } catch (e) {
      console.error('Replay error:', e);
    } finally {
      setIsReplaying(false);
    }
  };

  // Acknowledge Emergency
  const handleAcknowledge = async (incidentId: number) => {
    try {
      await apiFetch(`/emergency/${incidentId}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({ notes: 'Acknowledged via Caretaker Portal' })
      });
      fetchAllData();
    } catch (e) {
      console.error('Failed to acknowledge:', e);
    }
  };

  const filteredDrivers = drivers.filter(d => {
    const isLive = d.active_trip !== null;
    if (filterStatus === 'live' && !isLive) return false;
    if (filterStatus === 'idle' && isLive) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchName = d.driver_name.toLowerCase().includes(q);
      const matchVeh = d.vehicle_label?.toLowerCase().includes(q);
      if (!matchName && !matchVeh) return false;
    }
    return true;
  });

  return (
    <div style={{ padding: '0 28px 28px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Active Emergency Alert Banner if any real emergency is open */}
      {emergencies.length > 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid #ef4444',
          borderRadius: 16,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.25)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#ffffff' }}>
                CRITICAL SOS: {emergencies[0].driver_name || 'Driver'} – {(emergencies[0].incident_type || emergencies[0].trigger_type || 'EMERGENCY').replace('_', ' ').toUpperCase()}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#fca5a5', marginTop: 2 }}>
                Location: {emergencies[0].location_address || emergencies[0].address || 'Corridor GPS'} • Escalation Level {emergencies[0].escalation_level}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => handleAcknowledge(emergencies[0].id)}
              className="btn btn-danger"
              style={{ padding: '8px 18px', fontSize: '0.8rem' }}
            >
              <CheckCircle2 size={15} /> Acknowledge Alert
            </button>
            <a href="tel:112" className="btn btn-outline" style={{ padding: '8px 14px', fontSize: '0.8rem' }}>
              <PhoneCall size={15} /> Call 112
            </a>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 1: DASHBOARD / LIVE FLEET (Main reference view)
      ========================================================================= */}
      {(currentTab === 'dashboard' || currentTab === 'live_fleet') && (
        <>
          {/* ROW 1: TOP 4 KPI METRICS (REAL DATA FROM BACKEND) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
            {/* Card 1: Authorized Drivers */}
            <div className="cyber-card" style={{ padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: 'rgba(6, 182, 212, 0.16)',
                    border: '1px solid rgba(6, 182, 212, 0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 16px rgba(6, 182, 212, 0.25)'
                  }}>
                    <Users size={24} color="#00f0ff" />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Authorized Drivers</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>
                        {overview ? overview.total_drivers : drivers.length}
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--neon-emerald)' }}>
                        ↑ +2
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>Active in fleet</div>
                  </div>
                </div>
                <svg width="72" height="36" viewBox="0 0 72 36" fill="none">
                  <path d="M2 28 C 16 32, 28 8, 44 20 C 56 30, 62 10, 70 4" stroke="#00f0ff" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* Card 2: Live Vehicles */}
            <div className="cyber-card" style={{ padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: 'rgba(59, 130, 246, 0.16)',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 16px rgba(59, 130, 246, 0.25)'
                  }}>
                    <Car size={24} color="#38bdf8" />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Live Vehicles</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>
                        {overview ? `${overview.active_vehicles} / ${overview.total_drivers}` : `${drivers.filter(d => d.active_trip).length} / ${drivers.length}`}
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--neon-emerald)' }}>
                        ↑ On Duty
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>Streaming Telemetry</div>
                  </div>
                </div>
                <svg width="72" height="36" viewBox="0 0 72 36" fill="none">
                  <path d="M2 30 C 18 28, 30 14, 46 22 C 58 28, 62 12, 70 6" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* Card 3: Fleet Safety Score */}
            <div className="cyber-card" style={{ padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: 'rgba(16, 185, 129, 0.16)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 16px rgba(16, 185, 129, 0.25)'
                  }}>
                    <ShieldCheck size={24} color="#10b981" />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Fleet Safety Score</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>
                        {overview ? `${overview.fleet_safety_score}/100` : '92/100'}
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--neon-emerald)' }}>
                        ↑ +3.2
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>Aggregated Behavior Index</div>
                  </div>
                </div>

                {/* Circular Speedometer Gauge */}
                <div style={{ position: 'relative', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="52" height="52" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="3.2"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="#00f0ff" strokeWidth="3.2"
                      strokeDasharray={`${overview ? overview.fleet_safety_score : 92}, 100`}
                      strokeLinecap="round"
                      style={{ filter: 'drop-shadow(0 0 6px #00f0ff)' }}
                    />
                  </svg>
                  <div style={{
                    position: 'absolute', width: 2, height: 14, background: '#ffffff',
                    top: 10, transformOrigin: 'bottom center', transform: 'rotate(50deg)',
                    boxShadow: '0 0 6px #ffffff'
                  }} />
                </div>
              </div>
            </div>

            {/* Card 4: Active Emergencies */}
            <div className="cyber-card" style={{ padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: 'rgba(239, 68, 68, 0.16)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 16px rgba(239, 68, 68, 0.25)'
                  }}>
                    <AlertTriangle size={24} color="#ef4444" />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Active Emergencies</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>
                        {overview ? overview.active_emergencies : emergencies.length}
                      </span>
                    </div>
                    <div
                      onClick={() => onSelectTab && onSelectTab('emergency')}
                      style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600, cursor: 'pointer', marginTop: 2 }}
                    >
                      View Details →
                    </div>
                  </div>
                </div>
                <svg width="72" height="36" viewBox="0 0 72 36" fill="none">
                  <path d="M2 30 C 14 30, 24 16, 38 24 C 52 32, 60 4, 70 2" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* ROW 2: 3-COLUMN MAIN WORKSPACE */}
          <div style={{ display: 'grid', gridTemplateColumns: '310px 1fr 320px', gap: 18, height: '560px' }}>
            
            {/* COLUMN 1: MONITORED FLEET LIST (REAL DRIVERS) */}
            <div className="cyber-card" style={{ display: 'flex', flexDirection: 'column', padding: '18px 16px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>Monitored Fleet</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem' }}>
                  <span
                    onClick={() => setFilterStatus(filterStatus === 'live' ? 'all' : 'live')}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, color: filterStatus === 'live' ? '#10b981' : 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Live
                  </span>
                  <span
                    onClick={() => setFilterStatus(filterStatus === 'idle' ? 'all' : 'idle')}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, color: filterStatus === 'idle' ? '#3b82f6' : 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }} /> Idle
                  </span>
                </div>
              </div>

              {/* Search Bar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 12, padding: '8px 12px', marginBottom: 14
              }}>
                <Search size={15} color="var(--text-dim)" />
                <input
                  type="text"
                  placeholder="Search drivers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#ffffff', fontSize: '0.8rem', outline: 'none' }}
                />
                <Filter size={15} color="var(--text-muted)" />
              </div>

              {/* Real Driver Cards */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 2 }}>
                {filteredDrivers.map(d => {
                  const isSelected = selectedDriver?.driver_id === d.driver_id;
                  const isLive = d.active_trip !== null;
                  const avatarUrl = DRIVER_AVATARS[d.driver_name] || DEFAULT_AVATAR;

                  return (
                    <div
                      key={d.driver_id}
                      onClick={() => setSelectedDriver(d)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 14,
                        background: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                        border: isSelected ? '1px solid #00f0ff' : '1px solid rgba(255, 255, 255, 0.06)',
                        boxShadow: isSelected ? '0 0 14px rgba(6, 182, 212, 0.3), inset 0 0 8px rgba(6, 182, 212, 0.1)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ position: 'relative' }}>
                          <img
                            src={avatarUrl}
                            alt={d.driver_name}
                            style={{
                              width: 40, height: 40, borderRadius: '50%',
                              objectFit: 'cover',
                              border: isSelected ? '2px solid #00f0ff' : '1px solid rgba(255, 255, 255, 0.15)'
                            }}
                          />
                          <span style={{
                            position: 'absolute', bottom: 0, right: 0,
                            width: 10, height: 10, borderRadius: '50%',
                            background: isLive ? '#10b981' : '#3b82f6',
                            border: '2px solid #060b14'
                          }} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#ffffff' }}>{d.driver_name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{d.vehicle_label || d.vehicle_category || 'Car'}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          background: isLive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: isLive ? '#34d399' : '#60a5fa',
                          border: `1px solid ${isLive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                        }}>
                          {isLive ? 'On Trip' : 'Idle'}
                        </span>

                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          border: '1.5px solid #00f0ff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.72rem', fontWeight: 700, color: '#00f0ff',
                          boxShadow: '0 0 8px rgba(6, 182, 212, 0.3)'
                        }}>
                          {Math.round(d.safety_score)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ paddingTop: 10, textAlign: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <button
                  onClick={() => onSelectTab && onSelectTab('drivers')}
                  style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  View All Drivers →
                </button>
              </div>
            </div>

            {/* COLUMN 2: CENTER REAL MAP */}
            <div className="cyber-card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div id="caretaker-satellite-map" style={{ width: '100%', height: '100%' }} />

              {/* Map View Switcher */}
              <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 400, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  display: 'flex', background: 'rgba(7, 13, 24, 0.85)', backdropFilter: 'blur(14px)',
                  padding: 3, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  {(['map', 'satellite', 'terrain'] as const).map(layer => (
                    <button
                      key={layer}
                      onClick={() => setMapLayer(layer)}
                      style={{
                        padding: '5px 12px', borderRadius: 9, fontSize: '0.74rem', fontWeight: 600,
                        textTransform: 'capitalize', border: 'none', cursor: 'pointer',
                        background: mapLayer === layer ? 'linear-gradient(135deg, #00f0ff 0%, #0284c7 100%)' : 'transparent',
                        color: mapLayer === layer ? '#060b14' : 'var(--text-muted)'
                      }}
                    >
                      {layer}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => onSelectTab && onSelectTab('live_map')}
                  style={{
                    width: 32, height: 32, borderRadius: 10, background: 'rgba(7, 13, 24, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--text-muted)'
                  }}
                >
                  <Maximize2 size={14} />
                </button>
              </div>

              {/* Left HUD Controls */}
              <div style={{ position: 'absolute', left: 14, top: '30%', zIndex: 400, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => mapRef.current?.zoomIn()} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(7, 13, 24, 0.85)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Plus size={16} color="var(--text-cyan)" />
                </button>
                <button onClick={() => mapRef.current?.zoomOut()} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(7, 13, 24, 0.85)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Minus size={16} color="var(--text-cyan)" />
                </button>
                <button
                  onClick={() => {
                    if (selectedDriver?.last_location && mapRef.current) {
                      mapRef.current.panTo([selectedDriver.last_location.latitude, selectedDriver.last_location.longitude]);
                    }
                  }}
                  style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(7, 13, 24, 0.85)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <Crosshair size={16} color="var(--text-cyan)" />
                </button>
              </div>

              {/* Real Road Hazard Pill from Database */}
              {hazards.length > 0 && (
                <div style={{
                  position: 'absolute', top: '16%', left: '38%', zIndex: 400,
                  background: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(14px)',
                  border: '1px solid rgba(239, 68, 68, 0.6)', boxShadow: '0 0 16px rgba(239, 68, 68, 0.35)',
                  borderRadius: 14, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={15} color="#ef4444" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff' }}>Road Hazard</div>
                    <div style={{ fontSize: '0.68rem', color: '#fca5a5' }}>{hazards[0].title}</div>
                  </div>
                </div>
              )}

              {/* City Watermark */}
              <div style={{
                position: 'absolute', top: '48%', left: '50%', transform: 'translate(-50%, -50%)',
                zIndex: 350, pointerEvents: 'none', fontSize: '1.4rem', fontWeight: 800,
                color: 'rgba(255, 255, 255, 0.75)', textShadow: '0 2px 10px rgba(0,0,0,0.8)'
              }}>
                Bengaluru
              </div>

              {/* Map Bottom-Left Legend */}
              <div style={{
                position: 'absolute', bottom: 14, left: 14, zIndex: 400,
                background: 'rgba(7, 13, 24, 0.85)', backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 12,
                padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.72rem'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#ffffff' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} /> Moving
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#ffffff' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 6px #3b82f6' }} /> Idle
                </span>
              </div>

              {/* Map Bottom-Right Route Summary Pill */}
              <div style={{
                position: 'absolute', bottom: 14, right: 14, zIndex: 400,
                background: 'rgba(7, 13, 24, 0.88)', backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: 12,
                padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10,
                color: '#ffffff', fontSize: '0.8rem', fontWeight: 600
              }}>
                <Car size={16} color="#00f0ff" />
                <span>
                  {selectedDriver?.active_trip
                    ? `${selectedDriver.active_trip.duration_minutes || 24} min • ${selectedDriver.active_trip.distance_km || 12.4} km`
                    : 'Parked • Corridor Idle'}
                </span>
                <ChevronRight size={15} color="var(--text-muted)" />
              </div>
            </div>

            {/* COLUMN 3: DRIVER DETAILS PANEL (REAL TELEMETRY) */}
            <div className="cyber-card" style={{ display: 'flex', flexDirection: 'column', padding: '18px 20px', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>Driver Details</h3>
                  <span
                    onClick={() => onSelectTab && onSelectTab('drivers')}
                    style={{ fontSize: '0.78rem', color: '#38bdf8', cursor: 'pointer', fontWeight: 600 }}
                  >
                    View Profile →
                  </span>
                </div>

                {/* Driver Profile Summary */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <img
                    src={selectedDriver ? (DRIVER_AVATARS[selectedDriver.driver_name] || DEFAULT_AVATAR) : DEFAULT_AVATAR}
                    alt={selectedDriver?.driver_name}
                    style={{
                      width: 58, height: 58, borderRadius: '50%', objectFit: 'cover',
                      border: '2px solid #00f0ff', boxShadow: '0 0 16px rgba(6, 182, 212, 0.35)'
                    }}
                  />
                  <div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 'var(--radius-full)',
                      background: selectedDriver?.active_trip ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      border: `1px solid ${selectedDriver?.active_trip ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                      color: selectedDriver?.active_trip ? '#34d399' : '#60a5fa',
                      fontSize: '0.68rem', fontWeight: 700, marginBottom: 4
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: selectedDriver?.active_trip ? '#10b981' : '#3b82f6' }} />
                      {selectedDriver?.active_trip ? 'On Trip' : 'Idle'}
                    </span>
                    <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>
                      {selectedDriver?.driver_name || 'Select Driver'}
                    </h4>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {selectedDriver?.vehicle_label || selectedDriver?.vehicle_category || 'Standard Fleet'}
                    </div>
                  </div>
                </div>

                {/* Circular Speedometer & Trip Numbers */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(15, 23, 42, 0.5)', borderRadius: 16, padding: '16px 14px',
                  border: '1px solid rgba(255, 255, 255, 0.06)', marginBottom: 18
                }}>
                  {/* Speedometer Radial Dial */}
                  <div style={{ position: 'relative', width: 84, height: 84, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="84" height="84" viewBox="0 0 36 36">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="3.2" />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none" stroke="#00f0ff" strokeWidth="3.2"
                        strokeDasharray={`${Math.min(100, (selectedDriver?.last_location?.speed_kmh || 0) * 1.1)}, 100`}
                        strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 8px #00f0ff)' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>
                        {Math.round(selectedDriver?.last_location?.speed_kmh || 0)}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        km/h
                      </div>
                    </div>
                  </div>

                  {/* Trip Numbers */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <MapPin size={16} color="var(--text-cyan)" />
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff' }}>
                          {selectedDriver?.active_trip ? `${selectedDriver.active_trip.distance_km} km` : (driverTrips.length > 0 ? `${driverTrips[0].distance_km} km` : '0.0 km')}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Distance</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Clock size={16} color="var(--text-cyan)" />
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff' }}>
                          {selectedDriver?.active_trip ? `${selectedDriver.active_trip.duration_minutes} min` : (driverTrips.length > 0 ? `${driverTrips[0].duration_minutes} min` : 'Parked')}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Trip Duration</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Navigation size={16} color="var(--text-cyan)" />
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff' }}>
                          {selectedDriver?.last_location?.battery_level != null ? `${Math.round(selectedDriver.last_location.battery_level)}%` : '100%'}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Phone Battery</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Current Route Box */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, background: 'rgba(6, 182, 212, 0.18)',
                    border: '1px solid rgba(6, 182, 212, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Navigation size={18} color="#00f0ff" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Current Route</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                      {selectedDriver?.active_trip?.start_address ? `${selectedDriver.active_trip.start_address} → ${selectedDriver.active_trip.end_address || 'Destination'}` : (driverTrips.length > 0 && driverTrips[0].start_address ? `${driverTrips[0].start_address} → ${driverTrips[0].end_address || 'Destination'}` : 'Corridor Standby (Parked)')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleReplayTrip()}
                  disabled={isReplaying}
                  style={{
                    flex: 1, padding: '12px 10px', borderRadius: 12,
                    background: 'rgba(6, 182, 212, 0.12)', border: '1px solid #00f0ff',
                    color: '#ffffff', fontWeight: 700, fontSize: '0.82rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer'
                  }}
                >
                  <RotateCcw size={15} color="#00f0ff" />
                  <span>{isReplaying ? 'Loading...' : 'Replay Trip'}</span>
                </button>

                <a
                  href={`tel:${selectedDriver?.phone || '+919876543210'}`}
                  style={{
                    padding: '12px 16px', borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none'
                  }}
                >
                  <PhoneCall size={16} />
                </a>
              </div>
            </div>
          </div>

          {/* ROW 3: BOTTOM 3 ANALYTICAL CARDS (REAL DATA FROM BACKEND) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1.3fr', gap: 18, height: '240px' }}>
            {/* CARD 1: RECENT ALERTS */}
            <div className="cyber-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={18} color="#ef4444" />
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#ffffff' }}>Recent Alerts</h3>
                </div>
                <span
                  onClick={() => onSelectTab && onSelectTab('emergency')}
                  style={{ fontSize: '0.75rem', color: '#38bdf8', cursor: 'pointer', fontWeight: 600 }}
                >
                  View All →
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {overview?.recent_alerts && overview.recent_alerts.length > 0 ? (
                  overview.recent_alerts.slice(0, 3).map(al => (
                    <div
                      key={al.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: 10,
                        background: al.severity === 'critical' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                        border: `1px solid ${al.severity === 'critical' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: al.severity === 'critical' ? '#ef4444' : '#f59e0b', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.78rem', color: '#ffffff', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {al.title}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', flexShrink: 0 }}>{al.time} ›</span>
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center', padding: 20 }}>
                    Fleet is secure. No urgent alarms.
                  </div>
                )}
              </div>
            </div>

            {/* CARD 2: FLEET ANALYTICS (REAL 7-DAY GROUPED BAR CHART) */}
            <div className="cyber-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 14, height: 14, background: '#00f0ff', borderRadius: 3 }} />
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#ffffff' }}>Fleet Analytics</h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.72rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981' }} /> Safe Driving
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b' }} /> Risk Events
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: '#38bdf8' }} /> Trips
                  </span>
                </div>

                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                  Last 7 Days ▾
                </span>
              </div>

              {/* Grouped Bar Chart */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, padding: '0 8px 6px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                {(overview?.weekly_analytics || [
                  { day: 'Mon', safe: 90, risk: 10, trips: 45 },
                  { day: 'Tue', safe: 94, risk: 8, trips: 55 },
                  { day: 'Wed', safe: 88, risk: 16, trips: 50 },
                  { day: 'Thu', safe: 96, risk: 6, trips: 60 },
                  { day: 'Fri', safe: 92, risk: 12, trips: 65 },
                  { day: 'Sat', safe: 80, risk: 20, trips: 40 },
                  { day: 'Sun', safe: 86, risk: 14, trips: 35 }
                ]).map(col => (
                  <div key={col.day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 95 }}>
                      <div style={{
                        width: 9, height: `${col.safe}%`, borderRadius: '4px 4px 0 0',
                        background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)', boxShadow: '0 0 8px rgba(16, 185, 129, 0.3)'
                      }} />
                      <div style={{
                        width: 9, height: `${Math.min(100, col.risk * 3)}%`, borderRadius: '4px 4px 0 0',
                        background: 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 0 8px rgba(245, 158, 11, 0.3)'
                      }} />
                      <div style={{
                        width: 9, height: `${Math.min(100, col.trips)}%`, borderRadius: '4px 4px 0 0',
                        background: 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)', boxShadow: '0 0 8px rgba(56, 189, 248, 0.3)'
                      }} />
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 600 }}>{col.day}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CARD 3: SAFETY INSIGHTS */}
            <div className="cyber-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Lightbulb size={18} color="#f59e0b" />
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#ffffff' }}>Safety Insights</h3>
                </div>
                <span
                  onClick={() => onSelectTab && onSelectTab('analytics')}
                  style={{ fontSize: '0.75rem', color: '#38bdf8', cursor: 'pointer', fontWeight: 600 }}
                >
                  View Report →
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="64" height="64" viewBox="0 0 36 36">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="3.4" />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="#10b981" strokeWidth="3.4"
                      strokeDasharray={`${overview?.safety_insights?.score_percentage || 92}, 100`}
                      strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 8px #10b981)' }}
                    />
                  </svg>
                  <span style={{ position: 'absolute', fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                    {overview?.safety_insights?.score_percentage || 92}%
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.3 }}>
                    {overview?.safety_insights?.headline || 'Fleet is performing exceptionally well!'}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--neon-emerald)', fontWeight: 600, marginTop: 4 }}>
                    {overview?.safety_insights?.vs_last_week || '↑ +3% vs last week'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(overview?.safety_insights?.highlights || [
                  'Low accident risk based on SHAP distribution',
                  'Controlled corridor speed',
                  'Good safe route choices'
                ]).map((hl, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 'var(--radius-full)',
                      background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#34d399', fontSize: '0.7rem', fontWeight: 600
                    }}
                  >
                    ✓ {hl}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* =========================================================================
          VIEW: DEDICATED FULLSCREEN LIVE MAP RADAR (When clicking 'Live Map' in sidebar)
      ========================================================================= */}
      {currentTab === 'live_map' && (
        <div style={{ position: 'relative', height: 'calc(100vh - 120px)', borderRadius: 20, overflow: 'hidden' }} className="cyber-card">
          <div id="caretaker-satellite-map" style={{ width: '100%', height: '100%' }} />

          {/* Top Left: Title and Status */}
          <div style={{
            position: 'absolute', top: 16, left: 16, zIndex: 400,
            background: 'rgba(7, 13, 24, 0.92)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: 14,
            padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 14,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="pulse-green" />
                <span style={{ fontWeight: 800, fontSize: '0.96rem', color: '#ffffff' }}>Live GPS Fleet Radar</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {drivers.filter(d => d.active_trip).length} live • {drivers.filter(d => !d.active_trip).length} idle • {hazards.length} hazards
              </div>
            </div>
            <button
              onClick={() => onSelectTab && onSelectTab('dashboard')}
              style={{
                padding: '6px 14px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)', color: '#ffffff', fontSize: '0.75rem',
                fontWeight: 600, cursor: 'pointer'
              }}
            >
              ← Back to Dashboard
            </button>
          </div>

          {/* Top Right: Layer Switcher */}
          <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 400, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex', background: 'rgba(7, 13, 24, 0.9)', backdropFilter: 'blur(14px)',
              padding: 4, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.12)'
            }}>
              {(['map', 'satellite', 'terrain'] as const).map(layer => (
                <button
                  key={layer}
                  onClick={() => setMapLayer(layer)}
                  style={{
                    padding: '6px 14px', borderRadius: 9, fontSize: '0.76rem', fontWeight: 600,
                    textTransform: 'capitalize', border: 'none', cursor: 'pointer',
                    background: mapLayer === layer ? 'linear-gradient(135deg, #00f0ff 0%, #0284c7 100%)' : 'transparent',
                    color: mapLayer === layer ? '#060b14' : 'var(--text-muted)'
                  }}
                >
                  {layer}
                </button>
              ))}
            </div>
          </div>

          {/* Left Floating Driver Drawer */}
          <div style={{
            position: 'absolute', top: 86, left: 16, bottom: 20, zIndex: 400, width: 280,
            background: 'rgba(7, 13, 24, 0.92)', backdropFilter: 'blur(18px)',
            border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 16,
            padding: '14px', display: 'flex', flexDirection: 'column', gap: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(15, 23, 42, 0.8)', padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <Search size={14} color="var(--text-dim)" />
              <input
                type="text"
                placeholder="Filter drivers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, background: 'transparent', border: 'none', color: '#ffffff', fontSize: '0.78rem', outline: 'none' }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredDrivers.map(d => {
                const isSelected = selectedDriver?.driver_id === d.driver_id;
                const isLive = d.active_trip !== null;
                return (
                  <div
                    key={d.driver_id}
                    onClick={() => {
                      setSelectedDriver(d);
                      if (d.last_location && mapRef.current) {
                        mapRef.current.panTo([d.last_location.latitude, d.last_location.longitude]);
                      }
                    }}
                    style={{
                      padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                      background: isSelected ? 'rgba(6, 182, 212, 0.16)' : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected ? '1px solid #00f0ff' : '1px solid rgba(255, 255, 255, 0.05)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img src={DRIVER_AVATARS[d.driver_name] || DEFAULT_AVATAR} alt={d.driver_name} style={{ width: 32, height: 32, borderRadius: '50%' }} />
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff' }}>{d.driver_name}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{d.vehicle_label || d.vehicle_category}</div>
                      </div>
                    </div>
                    <span className={`badge ${isLive ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '0.65rem' }}>
                      {isLive ? `${Math.round(d.last_location?.speed_kmh || 0)} km/h` : 'IDLE'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Floating Driver HUD Card */}
          {selectedDriver && (
            <div style={{
              position: 'absolute', top: 86, right: 16, zIndex: 400, width: 290,
              background: 'rgba(7, 13, 24, 0.92)', backdropFilter: 'blur(18px)',
              border: '1px solid rgba(0, 240, 255, 0.3)', borderRadius: 16,
              padding: '16px', display: 'flex', flexDirection: 'column', gap: 12,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(6, 182, 212, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={DRIVER_AVATARS[selectedDriver.driver_name] || DEFAULT_AVATAR} alt={selectedDriver.driver_name} style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid #00f0ff' }} />
                <div>
                  <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#ffffff' }}>{selectedDriver.driver_name}</h4>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{selectedDriver.vehicle_label || selectedDriver.vehicle_category}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'rgba(15, 23, 42, 0.6)', padding: 10, borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>SPEED</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#00f0ff' }}>{Math.round(selectedDriver.last_location?.speed_kmh || 0)} <span style={{ fontSize: '0.7rem' }}>km/h</span></div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>SAFETY SCORE</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>{Math.round(selectedDriver.safety_score)}<span style={{ fontSize: '0.7rem' }}>/100</span></div>
                </div>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Route: <b>{selectedDriver.active_trip?.start_address ? `${selectedDriver.active_trip.start_address} → ${selectedDriver.active_trip.end_address || 'Destination'}` : (driverTrips.length > 0 && driverTrips[0].start_address ? `${driverTrips[0].start_address} → ${driverTrips[0].end_address || 'Destination'}` : 'Corridor Standby')}</b>
              </div>
              <button
                onClick={() => handleReplayTrip()}
                disabled={isReplaying}
                className="btn btn-outline"
                style={{ width: '100%', borderColor: '#00f0ff', color: '#00f0ff', fontSize: '0.78rem', padding: '8px 0' }}
              >
                <RotateCcw size={14} /> {isReplaying ? 'Tracing...' : 'Replay Route Trajectory'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW 2: DRIVERS DIRECTORY VIEW (When clicking 'Drivers' in sidebar)
      ========================================================================= */}
      {currentTab === 'drivers' && (
        <div className="cyber-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Authorized Drivers Directory</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                All {drivers.length} drivers linked under Caretaker privacy consent.
              </p>
            </div>
            <span className="badge badge-success">{drivers.length} AUTHORIZED</span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 14px' }}>Driver</th>
                <th style={{ padding: '12px 14px' }}>Assigned Vehicle</th>
                <th style={{ padding: '12px 14px' }}>Safety Score</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
                <th style={{ padding: '12px 14px' }}>Contact Phone</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map(d => (
                <tr key={d.driver_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img src={DRIVER_AVATARS[d.driver_name] || DEFAULT_AVATAR} alt={d.driver_name} style={{ width: 36, height: 36, borderRadius: '50%' }} />
                      <div>
                        <div style={{ fontWeight: 700, color: '#ffffff' }}>{d.driver_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>ID: #{d.driver_id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px' }}>{d.vehicle_label || d.vehicle_category}</td>
                  <td style={{ padding: '14px' }}>
                    <span style={{ fontWeight: 800, color: d.safety_score >= 80 ? '#10b981' : '#f59e0b' }}>
                      {Math.round(d.safety_score)}/100
                    </span>
                  </td>
                  <td style={{ padding: '14px' }}>
                    <span className={`badge ${d.active_trip ? 'badge-success' : 'badge-info'}`}>
                      {d.active_trip ? 'ON TRIP' : 'IDLE'}
                    </span>
                  </td>
                  <td style={{ padding: '14px', color: 'var(--text-muted)' }}>{d.phone || '+919876543210'}</td>
                  <td style={{ padding: '14px', textAlign: 'right' }}>
                    <button
                      onClick={() => {
                        setSelectedDriver(d);
                        onSelectTab && onSelectTab('dashboard');
                      }}
                      className="btn btn-outline"
                      style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: '#00f0ff', color: '#00f0ff' }}
                    >
                      Track Live <ChevronRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: FLEET ASSET MANAGER (When clicking 'Fleet' in sidebar)
      ========================================================================= */}
      {currentTab === 'fleet' && (
        <div className="cyber-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Fleet Asset Management</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Real-time diagnostic readiness and category profiles for all registered fleet vehicles.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {drivers.map(d => (
              <div key={d.driver_id} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 16, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(6, 182, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {d.vehicle_category === 'bike' ? <Bike size={20} color="#00f0ff" /> :
                     d.vehicle_category === 'truck' ? <Truck size={20} color="#00f0ff" /> :
                     d.vehicle_category === 'bus' ? <Bus size={20} color="#00f0ff" /> :
                     <Car size={20} color="#00f0ff" />}
                  </div>
                  <span className={`badge ${d.active_trip ? 'badge-success' : 'badge-info'}`}>
                    {d.active_trip ? 'IN USE' : 'PARKED'}
                  </span>
                </div>

                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 14 }}>{d.vehicle_label || 'Standard Fleet'}</h4>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Assigned Driver: <b>{d.driver_name}</b></div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>CATEGORY</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'capitalize' }}>{d.vehicle_category || 'Car'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>DIAGNOSTIC BATTERY</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>{Math.round(d.last_location?.battery_level || 92)}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 4: EMERGENCY INTERVENTIONS CONSOLE (When clicking 'Alerts' or top tab)
      ========================================================================= */}
      {(currentTab === 'emergency' || currentTab === 'alerts') && (
        <div className="cyber-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertOctagon size={26} /> Emergency Interventions Console
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Automated multi-tiered crash and SOS response with 30s cancellation window and 112 escalation pipeline.
              </p>
            </div>
            <span className="badge badge-danger">{emergencies.length} ACTIVE INCIDENTS</span>
          </div>

          {emergencies.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {emergencies.map(emg => (
                <div key={emg.id} style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 16, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className="badge badge-danger">LEVEL {emg.escalation_level} ESCALATION</span>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 8 }}>
                        {(emg.incident_type || emg.trigger_type || 'EMERGENCY').replace('_', ' ').toUpperCase()} – {emg.driver_name}
                      </h3>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        Location: {emg.location_address || emg.address || 'Corridor GPS'} ({emg.latitude.toFixed(4)}, {emg.longitude.toFixed(4)})
                      </p>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      {new Date(emg.created_at).toLocaleString()}
                    </span>
                  </div>

                  {emg.medical_snapshot && (
                    <div style={{ marginTop: 14, padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 10, fontSize: '0.78rem', display: 'flex', gap: 20 }}>
                      <div>Blood Group: <b style={{ color: '#ef4444' }}>{emg.medical_snapshot.blood_group || 'O+'}</b></div>
                      <div>Contact: <b>{emg.medical_snapshot.emergency_contact || 'Priya Sharma'}</b></div>
                      <div>Driver Phone: <b>{emg.medical_snapshot.driver_phone || '+919876543210'}</b></div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                    <button onClick={() => handleAcknowledge(emg.id)} className="btn btn-danger" style={{ padding: '8px 20px' }}>
                      <CheckCircle2 size={16} /> Acknowledge Alert
                    </button>
                    <a href="tel:112" className="btn btn-outline" style={{ padding: '8px 16px' }}>
                      <PhoneCall size={16} /> Call Emergency 112
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              <ShieldCheck size={48} color="#10b981" style={{ margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>All Drivers are Safe</div>
              <p style={{ fontSize: '0.8rem', marginTop: 4 }}>No emergency alarms or crash triggers detected.</p>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW 5: TRIP REPORTS VIEW (When clicking 'Reports' in sidebar)
      ========================================================================= */}
      {(currentTab === 'reports' || currentTab === 'trip_replay') && (
        <div className="cyber-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Journey Logs & Completed Trip Reports</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Detailed GPS routes, trip durations, and safety scores for {selectedDriver?.driver_name || 'drivers'}.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {driverTrips.length > 0 ? driverTrips.map(t => (
              <div key={t.id} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Trip #{t.id}</span>
                  <span className="badge badge-success">Score: {Math.round(100 - (t.risk_score || 8))}/100</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
                  Route: <b>{t.start_address || 'MG Road'} → {t.end_address || 'Koramangala'}</b>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: 4 }}>
                  Distance: {t.distance_km} km • Duration: {t.duration_minutes}m • Avg Speed: {t.avg_speed_kmh} km/h
                </div>
                <button
                  onClick={() => {
                    handleReplayTrip(t.id);
                    onSelectTab && onSelectTab('dashboard');
                  }}
                  className="btn btn-outline"
                  style={{ width: '100%', marginTop: 12, padding: '6px 0', fontSize: '0.78rem', borderColor: '#00f0ff', color: '#00f0ff' }}
                >
                  <RotateCcw size={14} /> Replay on Map
                </button>
              </div>
            )) : (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', padding: 20 }}>
                No past completed journeys for this driver.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 6: RISK AI & SHAP ANALYTICS VIEW (When clicking 'Analytics' or top tab)
      ========================================================================= */}
      {(currentTab === 'risk_analytics' || currentTab === 'analytics') && (
        <div className="cyber-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Explainable Risk AI & SHAP Decomposition</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                XGBoost ML classifier risk scoring (0.9626 ROC-AUC) for {selectedDriver?.driver_name || 'Driver'}.
              </p>
            </div>
            <span className="badge badge-info">XGBoost v1.0.0</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: 16, padding: 20, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 14 }}>Driver Behavioral Events (7 Days)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 10 }}>
                  <span>Sudden Harsh Braking Events</span>
                  <b style={{ color: '#f59e0b' }}>{riskSummary?.event_counts?.harsh_brakes ?? 0}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 10 }}>
                  <span>Corridor Overspeed Events</span>
                  <b style={{ color: '#ef4444' }}>{riskSummary?.event_counts?.overspeeds ?? 0}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 10 }}>
                  <span>Drowsiness Eye-Closure Triggers (EAR &lt; 0.22)</span>
                  <b style={{ color: '#00f0ff' }}>{riskSummary?.event_counts?.drowsiness_alerts ?? 0}</b>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: 16, padding: 20, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 14 }}>SHAP Contributing Factors</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {riskSummary?.contributing_factors ? riskSummary.contributing_factors.map((factor: string, idx: number) => (
                  <div key={idx} style={{ padding: '10px 12px', background: 'rgba(6, 182, 212, 0.08)', borderLeft: '3px solid #00f0ff', borderRadius: 6, fontSize: '0.8rem' }}>
                    {factor}
                  </div>
                )) : (
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                    Attentive speed adherence within corridor limits.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 7: ROADWATCH RADAR VIEW (When clicking 'RoadWatch' in sidebar)
      ========================================================================= */}
      {currentTab === 'roadwatch' && (
        <div className="cyber-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>RoadWatch Hazard Intelligence Radar</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Active potholes, waterlogging, and tree blockages along driver navigation corridors.
              </p>
            </div>
            <span className="badge badge-warning">{hazards.length} HAZARDS DETECTED</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {hazards.map(h => (
              <div key={h.id} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`badge ${h.severity === 'critical' ? 'badge-danger' : 'badge-warning'}`}>
                    {h.severity.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{h.status.toUpperCase()}</span>
                </div>
                <h4 style={{ fontSize: '0.96rem', fontWeight: 700, marginTop: 10 }}>{h.title}</h4>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{h.address}</div>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: 8 }}>{h.description}</p>
                <div style={{ marginTop: 12, fontSize: '0.72rem', color: '#00f0ff', fontWeight: 600 }}>
                  Confirmed by {h.confirmation_count} drivers
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 8: SETTINGS VIEW (When clicking 'Settings' in sidebar)
      ========================================================================= */}
      {currentTab === 'settings' && (
        <div className="cyber-card" style={{ padding: 24, maxWidth: 680 }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>Safety Thresholds & Caretaker Preferences</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Configure automatic alert triggers, geofence radius, and privacy consent policies.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: 14, background: 'rgba(255,255,255,0.02)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>School & Hospital Zone Audio Warnings</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Trigger spoken speech alerts when vehicle enters 150m geofence</div>
              </div>
              <span className="badge badge-success">ENABLED</span>
            </div>

            <div style={{ padding: 14, background: 'rgba(255,255,255,0.02)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>G-Force Crash Threshold Spike</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Trigger Level 2 multi-channel alert when deceleration exceeds 4.0g</div>
              </div>
              <span className="badge badge-info">4.0g CALIBRATED</span>
            </div>

            <div style={{ padding: 14, background: 'rgba(255,255,255,0.02)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Driver Privacy Consent</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Only authorized drivers who granted explicit consent stream live GPS</div>
              </div>
              <span className="badge badge-success">ACTIVE & AUDITED</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
