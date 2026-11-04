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
  Crosshair
} from 'lucide-react';

declare const L: any;

interface CaretakerDashboardProps {
  currentTab?: string;
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

  const fetchAllData = async () => {
    try {
      const ovData: CaretakerOverview = await apiFetch('/caretaker/overview');
      setOverview(ovData);

      const driverList: MonitoredDriver[] = await apiFetch('/caretaker/monitored-drivers');
      setDrivers(driverList);
      if (driverList.length > 0 && !selectedDriver) {
        setSelectedDriver(driverList[0]);
      }

      const emgList: EmergencyIncident[] = await apiFetch('/emergency/active');
      setEmergencies(emgList || []);

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

  useEffect(() => {
    const mapEl = document.getElementById('caretaker-satellite-map');
    if (!mapEl || mapRef.current || typeof L === 'undefined') return;

    const map = L.map('caretaker-satellite-map', {
      center: [12.9716, 77.5946],
      zoom: 13,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map);

    mapRef.current = map;
  }, [currentTab]);

  useEffect(() => {
    if (!mapRef.current || typeof L === 'undefined') return;

    Object.values(markersRef.current).forEach((m: any) => m.remove());
    markersRef.current = {};

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

    if (selectedDriver && selectedDriver.last_location) {
      mapRef.current.panTo([selectedDriver.last_location.latitude, selectedDriver.last_location.longitude]);
    }
  }, [drivers, hazards, selectedDriver]);

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
      {emergencies.length > 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444',
          borderRadius: 16, padding: '14px 20px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', boxShadow: '0 0 20px rgba(239, 68, 68, 0.25)'
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
            <button onClick={() => handleAcknowledge(emergencies[0].id)} className="btn btn-danger" style={{ padding: '8px 18px', fontSize: '0.8rem' }}>
              <CheckCircle2 size={15} /> Acknowledge Alert
            </button>
            <a href="tel:112" className="btn btn-outline" style={{ padding: '8px 14px', fontSize: '0.8rem' }}>
              <PhoneCall size={15} /> Call 112
            </a>
          </div>
        </div>
      )}

      {/* Main View */}
      {(!currentTab || currentTab === 'dashboard' || currentTab === 'live_fleet') && (
        <>
          {/* Top 4 KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
            <div className="cyber-card" style={{ padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: 'rgba(6, 182, 212, 0.16)', border: '1px solid rgba(6, 182, 212, 0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Users size={24} color="#00f0ff" />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Authorized Drivers</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>
                        {overview ? overview.total_drivers : drivers.length}
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--neon-emerald)' }}>↑ +2</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>Active in fleet</div>
                  </div>
                </div>
                <svg width="72" height="36" viewBox="0 0 72 36" fill="none">
                  <path d="M2 28 C 16 32, 28 8, 44 20 C 56 30, 62 10, 70 4" stroke="#00f0ff" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            <div className="cyber-card" style={{ padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: 'rgba(59, 130, 246, 0.16)', border: '1px solid rgba(59, 130, 246, 0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Car size={24} color="#38bdf8" />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Live Vehicles</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>
                        {overview ? `${overview.active_vehicles} / ${overview.total_drivers}` : `${drivers.filter(d => d.active_trip).length} / ${drivers.length}`}
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--neon-emerald)' }}>↑ On Duty</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>Streaming Telemetry</div>
                  </div>
                </div>
                <svg width="72" height="36" viewBox="0 0 72 36" fill="none">
                  <path d="M2 30 C 18 28, 30 14, 46 22 C 58 28, 62 12, 70 6" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            <div className="cyber-card" style={{ padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: 'rgba(16, 185, 129, 0.16)', border: '1px solid rgba(16, 185, 129, 0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <ShieldCheck size={24} color="#10b981" />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fleet Safety Score</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>
                        {overview ? `${overview.fleet_safety_score}/100` : '92/100'}
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--neon-emerald)' }}>↑ +3.2</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>Aggregated Behavior</div>
                  </div>
                </div>

                <div style={{ position: 'relative', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="52" height="52" viewBox="0 0 36 36">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="3.2" />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="#00f0ff" strokeWidth="3.2"
                      strokeDasharray={`${overview ? overview.fleet_safety_score : 92}, 100`}
                      strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 6px #00f0ff)' }}
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

            <div className="cyber-card" style={{ padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: 'rgba(239, 68, 68, 0.16)', border: '1px solid rgba(239, 68, 68, 0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <AlertTriangle size={24} color="#ef4444" />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Emergencies</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>
                        {overview ? overview.active_emergencies : emergencies.length}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600, marginTop: 2 }}>
                      Live Queue Active
                    </div>
                  </div>
                </div>
                <svg width="72" height="36" viewBox="0 0 72 36" fill="none">
                  <path d="M2 30 C 14 30, 24 16, 38 24 C 52 32, 60 4, 70 2" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* 3-Column Workspace */}
          <div style={{ display: 'grid', gridTemplateColumns: '310px 1fr 320px', gap: 18, height: '560px' }}>
            {/* Column 1: Monitored Fleet */}
            <div className="cyber-card" style={{ display: 'flex', flexDirection: 'column', padding: '18px 16px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>Monitored Fleet</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem' }}>
                  <span onClick={() => setFilterStatus(filterStatus === 'live' ? 'all' : 'live')} style={{ display: 'flex', alignItems: 'center', gap: 4, color: filterStatus === 'live' ? '#10b981' : 'var(--text-muted)', cursor: 'pointer' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Live
                  </span>
                  <span onClick={() => setFilterStatus(filterStatus === 'idle' ? 'all' : 'idle')} style={{ display: 'flex', alignItems: 'center', gap: 4, color: filterStatus === 'idle' ? '#3b82f6' : 'var(--text-muted)', cursor: 'pointer' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }} /> Idle
                  </span>
                </div>
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: '8px 12px', marginBottom: 14
              }}>
                <Search size={15} color="var(--text-dim)" />
                <input
                  type="text" placeholder="Search drivers..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#ffffff', fontSize: '0.8rem', outline: 'none' }}
                />
                <Filter size={15} color="var(--text-muted)" />
              </div>

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
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: 14,
                        background: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                        border: isSelected ? '1px solid #00f0ff' : '1px solid rgba(255, 255, 255, 0.06)',
                        boxShadow: isSelected ? '0 0 14px rgba(6, 182, 212, 0.3)' : 'none',
                        cursor: 'pointer', transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ position: 'relative' }}>
                          <img src={avatarUrl} alt={d.driver_name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                          <span style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: isLive ? '#10b981' : '#3b82f6', border: '2px solid #060b14' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#ffffff' }}>{d.driver_name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{d.vehicle_label || d.vehicle_category}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 600,
                          background: isLive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: isLive ? '#34d399' : '#60a5fa'
                        }}>
                          {isLive ? 'On Trip' : 'Idle'}
                        </span>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #00f0ff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#00f0ff'
                        }}>
                          {Math.round(d.safety_score)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Column 2: Map */}
            <div className="cyber-card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div id="caretaker-satellite-map" style={{ width: '100%', height: '100%' }} />

              <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 400, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', background: 'rgba(7, 13, 24, 0.85)', padding: 3, borderRadius: 12 }}>
                  {(['map', 'satellite', 'terrain'] as const).map(layer => (
                    <button
                      key={layer} onClick={() => setMapLayer(layer)}
                      style={{
                        padding: '5px 12px', borderRadius: 9, fontSize: '0.74rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                        background: mapLayer === layer ? 'linear-gradient(135deg, #00f0ff 0%, #0284c7 100%)' : 'transparent',
                        color: mapLayer === layer ? '#060b14' : 'var(--text-muted)'
                      }}
                    >
                      {layer}
                    </button>
                  ))}
                </div>
              </div>

              {hazards.length > 0 && (
                <div style={{
                  position: 'absolute', top: '16%', left: '38%', zIndex: 400,
                  background: 'rgba(15, 23, 42, 0.92)', border: '1px solid rgba(239, 68, 68, 0.6)',
                  borderRadius: 14, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <AlertTriangle size={15} color="#ef4444" />
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff' }}>Road Hazard Ahead</div>
                    <div style={{ fontSize: '0.68rem', color: '#fca5a5' }}>{hazards[0].title}</div>
                  </div>
                </div>
              )}

              <div style={{
                position: 'absolute', bottom: 14, right: 14, zIndex: 400,
                background: 'rgba(7, 13, 24, 0.88)', borderRadius: 12, padding: '8px 16px',
                display: 'flex', alignItems: 'center', gap: 10, color: '#ffffff', fontSize: '0.8rem', fontWeight: 600
              }}>
                <Car size={16} color="#00f0ff" />
                <span>
                  {selectedDriver?.active_trip
                    ? `${selectedDriver.active_trip.duration_minutes || 24} min • ${selectedDriver.active_trip.distance_km || 12.4} km`
                    : 'Corridor Idle'}
                </span>
              </div>
            </div>

            {/* Column 3: Driver Details Panel */}
            <div className="cyber-card" style={{ display: 'flex', flexDirection: 'column', padding: '18px 20px', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>Driver Details</h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <img
                    src={selectedDriver ? (DRIVER_AVATARS[selectedDriver.driver_name] || DEFAULT_AVATAR) : DEFAULT_AVATAR}
                    alt={selectedDriver?.driver_name}
                    style={{ width: 58, height: 58, borderRadius: '50%', objectFit: 'cover', border: '2px solid #00f0ff' }}
                  />
                  <div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999,
                      background: selectedDriver?.active_trip ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: selectedDriver?.active_trip ? '#34d399' : '#60a5fa', fontSize: '0.68rem', fontWeight: 700, marginBottom: 4
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: selectedDriver?.active_trip ? '#10b981' : '#3b82f6' }} />
                      {selectedDriver?.active_trip ? 'On Trip' : 'Idle'}
                    </span>
                    <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>
                      {selectedDriver?.driver_name || 'Select Driver'}
                    </h4>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {selectedDriver?.vehicle_label || selectedDriver?.vehicle_category || 'Fleet Asset'}
                    </div>
                  </div>
                </div>

                {/* Speedometer Radial Dial */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(15, 23, 42, 0.5)', borderRadius: 16, padding: '16px 14px', marginBottom: 18
                }}>
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
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>km/h</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <MapPin size={16} color="var(--text-cyan)" />
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff' }}>
                          {selectedDriver?.active_trip ? `${selectedDriver.active_trip.distance_km} km` : '8.4 km'}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Distance</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Clock size={16} color="var(--text-cyan)" />
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff' }}>
                          {selectedDriver?.active_trip ? `${selectedDriver.active_trip.duration_minutes} min` : 'Completed'}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Trip Duration</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(15, 23, 42, 0.75)', borderRadius: 14, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16
                }}>
                  <Navigation size={18} color="#00f0ff" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Current Route</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedDriver?.active_trip?.start_address ? `${selectedDriver.active_trip.start_address} → ${selectedDriver.active_trip.end_address || 'Destination'}` : 'Indiranagar 100ft Road Corridor'}
                    </div>
                  </div>
                </div>
              </div>

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

          {/* Bottom 3 Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1.3fr', gap: 18, height: '240px' }}>
            {/* Card 1: Recent Alerts */}
            <div className="cyber-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={18} color="#ef4444" />
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#ffffff' }}>Recent Alerts</h3>
                </div>
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

            {/* Card 2: Fleet Analytics 7-Day */}
            <div className="cyber-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 14, height: 14, background: '#00f0ff', borderRadius: 3 }} />
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#ffffff' }}>Fleet Analytics</h3>
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Last 7 Days</span>
              </div>

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
                      <div style={{ width: 9, height: `${col.safe}%`, borderRadius: '4px 4px 0 0', background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)' }} />
                      <div style={{ width: 9, height: `${Math.min(100, col.risk * 3)}%`, borderRadius: '4px 4px 0 0', background: 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)' }} />
                      <div style={{ width: 9, height: `${Math.min(100, col.trips)}%`, borderRadius: '4px 4px 0 0', background: 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)' }} />
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 600 }}>{col.day}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3: Safety Insights */}
            <div className="cyber-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lightbulb size={18} color="#f59e0b" />
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#ffffff' }}>Safety Insights</h3>
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
                  'Controlled corridor speed'
                ]).map((hl, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
                      borderRadius: 999, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)',
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
    </div>
  );
};
