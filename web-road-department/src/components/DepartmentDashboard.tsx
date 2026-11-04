import React, { useEffect, useState, useRef } from 'react';
import { Hazard, DepartmentMetrics, apiFetch } from '../api';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Layers,
  Wrench,
  Search,
  Filter,
  Camera,
  MapPin,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  HardHat,
  BarChart3,
  Calendar,
  Image as ImageIcon
} from 'lucide-react';

declare const L: any;

interface DepartmentDashboardProps {
  currentTab: 'queue' | 'map' | 'analytics';
}

export const DepartmentDashboard: React.FC<DepartmentDashboardProps> = ({ currentTab = 'queue' }) => {
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [metrics, setMetrics] = useState<DepartmentMetrics>({
    total_reported: 0,
    open: 0,
    assigned: 0,
    in_progress: 0,
    fixed: 0,
    critical_unresolved: 0,
    avg_fix_time_hours: 3.2
  });
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedHazard, setSelectedHazard] = useState<Hazard | null>(null);
  const [actionNotes, setActionNotes] = useState<string>('');
  const [proofUrl, setProofUrl] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const mapRef = useRef<any>(null);
  const markersRef = useRef<{ [key: number]: any }>({});

  const fetchHazardsAndMetrics = async () => {
    try {
      const hazardData: Hazard[] = await apiFetch('/hazards/');
      setHazards(hazardData);

      const metricData = await apiFetch('/department/metrics');
      setMetrics(metricData);
    } catch (e) {
      console.error('Failed to load department data:', e);
    }
  };

  useEffect(() => {
    fetchHazardsAndMetrics();
    const interval = setInterval(fetchHazardsAndMetrics, 4000);
    return () => clearInterval(interval);
  }, []);

  // Initialize & update GIS map when switching to map tab
  useEffect(() => {
    if (currentTab !== 'map') return;

    const timer = setTimeout(() => {
      const mapEl = document.getElementById('department-gis-map');
      if (!mapEl) return;

      if (!mapRef.current && typeof L !== 'undefined') {
        const map = L.map('department-gis-map', {
          center: [12.9716, 77.5946],
          zoom: 13,
          zoomControl: false
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);
        mapRef.current = map;
      }

      // Render hazard pins
      if (mapRef.current && typeof L !== 'undefined') {
        // Clear previous markers
        Object.values(markersRef.current).forEach((m: any) => m.remove());
        markersRef.current = {};

        hazards.forEach(h => {
          const isCritical = h.severity?.toLowerCase() === 'critical';
          const isHigh = h.severity?.toLowerCase() === 'high';
          const isFixed = h.status?.toLowerCase() === 'fixed';

          const color = isFixed ? '#10b981' : isCritical ? '#f43f5e' : isHigh ? '#f59e0b' : '#3b82f6';
          const emoji = h.hazard_type === 'pothole' ? '🕳️' :
                        h.hazard_type === 'waterlogging' ? '🌊' :
                        h.hazard_type === 'fallen_tree' ? '🌲' : '⚠️';

          const iconHtml = `
            <div style="
              width: 36px; height: 36px;
              border-radius: 50%;
              background: ${color};
              border: 3px solid #ffffff;
              box-shadow: 0 0 12px ${color};
              display: flex; align-items: center; justify-content: center;
              font-size: 14px;
            ">
              ${emoji}
            </div>
          `;

          const markerIcon = L.divIcon({
            className: 'custom-hazard-marker',
            html: iconHtml,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          });

          const marker = L.marker([h.latitude, h.longitude], { icon: markerIcon }).addTo(mapRef.current);
          marker.bindPopup(`
            <div style="color: #0b0f19; font-family: sans-serif; padding: 4px; max-width: 200px;">
              <b style="font-size: 13px;">${h.title}</b><br/>
              <span style="font-size: 11px; color: #555;">Type: ${h.hazard_type.replace('_', ' ')}</span><br/>
              <span style="font-size: 11px; font-weight: bold; color: ${color};">Severity: ${h.severity.toUpperCase()}</span><br/>
              <span style="font-size: 11px;">Status: <b>${h.status.toUpperCase()}</b></span><br/>
              <span style="font-size: 10px; color: #777;">${h.address || ''}</span>
            </div>
          `);

          marker.on('click', () => {
            setSelectedHazard(h);
          });

          markersRef.current[h.id] = marker;
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [currentTab, hazards]);

  const handleStatusUpdate = async (hazardId: number, newStatus: string) => {
    try {
      setIsUpdating(true);
      await apiFetch(`/hazards/${hazardId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          new_status: newStatus,
          notes: actionNotes || `Status updated to ${newStatus} by Inspector Kumar (Road Maintenance)`,
          proof_image_url: proofUrl || undefined
        })
      });
      setSelectedHazard(null);
      setActionNotes('');
      setProofUrl('');
      fetchHazardsAndMetrics();
    } catch (e) {
      console.error('Failed to update status:', e);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredHazards = hazards.filter(h => {
    if (filterType !== 'all' && h.hazard_type !== filterType) return false;
    if (filterStatus !== 'all' && h.status !== filterStatus) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchTitle = h.title?.toLowerCase().includes(q);
      const matchAddress = h.address?.toLowerCase().includes(q);
      const matchType = h.hazard_type?.toLowerCase().includes(q);
      if (!matchTitle && !matchAddress && !matchType) return false;
    }
    return true;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return <span className="badge badge-danger">CRITICAL</span>;
      case 'high':
        return <span className="badge badge-warning">HIGH</span>;
      case 'medium':
        return <span className="badge badge-info">MEDIUM</span>;
      default:
        return <span className="badge badge-success">LOW</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'reported':
        return <span className="badge badge-danger">NEW REPORT</span>;
      case 'assigned':
      case 'in_progress':
        return <span className="badge badge-warning">CREW WORKING</span>;
      case 'fixed':
        return <span className="badge badge-success">FIXED & VERIFIED</span>;
      default:
        return <span className="badge badge-info">{status.toUpperCase()}</span>;
    }
  };

  return (
    <div style={{ padding: '0 16px 20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Metrics Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Critical Unresolved</span>
            <ShieldAlert size={18} color="var(--accent-rose)" />
          </div>
          <h2 style={{ fontSize: '1.8rem', marginTop: 8, color: 'var(--accent-rose)' }}>{metrics.critical_unresolved}</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>Urgent hazard queue (&gt;4.0g risk)</p>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Open Reports</span>
            <span className="badge badge-danger">NEW</span>
          </div>
          <h2 style={{ fontSize: '1.8rem', marginTop: 8 }}>{metrics.open}</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>Awaiting initial triage</p>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Repairs</span>
            <span className="badge badge-warning">DISPATCHED</span>
          </div>
          <h2 style={{ fontSize: '1.8rem', marginTop: 8, color: 'var(--accent-amber)' }}>{metrics.in_progress + metrics.assigned}</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>Crew assigned & working</p>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fixed & Verified</span>
            <span className="badge badge-success">RESOLVED</span>
          </div>
          <h2 style={{ fontSize: '1.8rem', marginTop: 8, color: 'var(--accent-emerald)' }}>{metrics.fixed}</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>Closed with photo evidence</p>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Avg Fix Time</span>
            <Clock size={18} color="var(--accent-cyan)" />
          </div>
          <h2 style={{ fontSize: '1.8rem', marginTop: 8, color: 'var(--accent-cyan)' }}>{metrics.avg_fix_time_hours}h</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>Dispatch to verified fix SLA</p>
        </div>
      </div>

      {/* TAB 1: QUEUE VIEW */}
      {currentTab === 'queue' && (
        <>
          {/* Filter Toolbar */}
          <div className="glass-panel" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={15} /> Hazard Type:
              </span>
              {['all', 'pothole', 'fallen_tree', 'waterlogging', 'crack'].map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`btn ${filterType === type ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '4px 12px', fontSize: '0.75rem', textTransform: 'capitalize' }}
                >
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <Search size={14} color="var(--text-dim)" />
                <input
                  type="text"
                  placeholder="Search street, area or hazard..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.8rem', outline: 'none', width: 180 }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status:</span>
                {['all', 'reported', 'in_progress', 'fixed'].map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`btn ${filterStatus === status ? 'btn-primary' : 'btn-outline'}`}
                    style={{ padding: '4px 12px', fontSize: '0.75rem', textTransform: 'capitalize' }}
                  >
                    {status.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Queue Table */}
          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 18px' }}>Hazard / Issue</th>
                  <th style={{ padding: '12px 18px' }}>Type</th>
                  <th style={{ padding: '12px 18px' }}>Severity</th>
                  <th style={{ padding: '12px 18px' }}>Location</th>
                  <th style={{ padding: '12px 18px' }}>Votes</th>
                  <th style={{ padding: '12px 18px' }}>Status</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHazards.length > 0 ? filteredHazards.map(h => (
                  <tr
                    key={h.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: selectedHazard?.id === h.id ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                      transition: 'background 0.2s'
                    }}
                  >
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{h.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>
                        Reported by {h.reporter_name || 'Driver'} • {new Date(h.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', textTransform: 'capitalize' }}>
                      {h.hazard_type.replace('_', ' ')}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      {getSeverityBadge(h.severity)}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
                        <MapPin size={14} color="var(--accent-amber)" />
                        <span>{h.address || `${h.latitude.toFixed(4)}, ${h.longitude.toFixed(4)}`}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--accent-amber)' }}>{h.confirmation_count}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}> drivers</span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      {getStatusBadge(h.status)}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedHazard(h)}
                        className="btn btn-primary"
                        style={{ padding: '6px 14px', fontSize: '0.75rem' }}
                      >
                        Manage Issue <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No road hazards match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TAB 2: GIS ROAD HAZARD MAP VIEW */}
      {currentTab === 'map' && (
        <div className="glass-panel" style={{ height: '640px', position: 'relative', overflow: 'hidden' }}>
          <div id="department-gis-map" style={{ width: '100%', height: '100%' }}></div>

          <div style={{
            position: 'absolute',
            top: 14,
            left: 14,
            zIndex: 400,
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(12px)',
            padding: '10px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600 }}>
              <Layers size={16} color="var(--accent-amber)" />
              <span>City Road Hazard GIS Layer</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>🔴 Critical ({metrics.critical_unresolved})</span>
              <span>🟠 Dispatched ({metrics.in_progress})</span>
              <span>🟢 Fixed ({metrics.fixed})</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RESOLUTION METRICS & SLA (REAL DYNAMIC CALCULATION) */}
      {currentTab === 'analytics' && (() => {
        const potholes = hazards.filter(h => h.hazard_type === 'pothole');
        const potholeResolvedPct = potholes.length > 0 ? Math.round((potholes.filter(h => h.status === 'fixed').length / potholes.length) * 100) : 100;

        const obstructions = hazards.filter(h => h.hazard_type === 'fallen_tree');
        const obstructionResolvedPct = obstructions.length > 0 ? Math.round((obstructions.filter(h => h.status === 'fixed').length / obstructions.length) * 100) : 100;

        const waterlogging = hazards.filter(h => h.hazard_type === 'waterlogging');
        const waterloggingResolvedPct = waterlogging.length > 0 ? Math.round((waterlogging.filter(h => h.status === 'fixed').length / waterlogging.length) * 100) : 100;

        const dispatchedHazards = hazards.filter(h => h.status === 'in_progress' || h.status === 'assigned');

        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="glass-panel" style={{ padding: 20 }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={18} color="var(--accent-amber)" /> Road Repair SLA Performance (Live Calculated)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>Pothole Repair Compliance ({potholes.filter(h => h.status === 'fixed').length}/{potholes.length} Resolved)</span>
                    <b style={{ color: potholeResolvedPct >= 80 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>{potholeResolvedPct}%</b>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 8 }}>
                    <div style={{ height: '100%', width: `${potholeResolvedPct}%`, background: potholeResolvedPct >= 80 ? 'var(--accent-emerald)' : 'var(--accent-amber)', borderRadius: 3 }}></div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>Fallen Tree Obstructions ({obstructions.filter(h => h.status === 'fixed').length}/{obstructions.length} Cleared)</span>
                    <b style={{ color: obstructionResolvedPct >= 80 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>{obstructionResolvedPct}%</b>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 8 }}>
                    <div style={{ height: '100%', width: `${obstructionResolvedPct}%`, background: obstructionResolvedPct >= 80 ? 'var(--accent-emerald)' : 'var(--accent-amber)', borderRadius: 3 }}></div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>Waterlogging Pumping Clearance ({waterlogging.filter(h => h.status === 'fixed').length}/{waterlogging.length} Pumped)</span>
                    <b style={{ color: waterloggingResolvedPct >= 80 ? 'var(--accent-emerald)' : 'var(--accent-cyan)' }}>{waterloggingResolvedPct}%</b>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 8 }}>
                    <div style={{ height: '100%', width: `${waterloggingResolvedPct}%`, background: waterloggingResolvedPct >= 80 ? 'var(--accent-emerald)' : 'var(--accent-cyan)', borderRadius: 3 }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: 20 }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <HardHat size={18} color="var(--accent-cyan)" /> Municipal Field Crews & Dispatched Work Orders
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dispatchedHazards.length > 0 ? dispatchedHazards.map(dh => (
                  <div key={dh.id} style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Work Order #{dh.id}: {dh.title}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Location: {dh.address || 'Road Corridor'} • Status: <span style={{ color: 'var(--accent-amber)' }}>{dh.status.toUpperCase()}</span></div>
                    </div>
                    <button
                      onClick={() => setSelectedHazard(dh)}
                      className="btn btn-outline"
                      style={{ padding: '4px 10px', fontSize: '0.72rem', borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)' }}
                    >
                      Update Fix
                    </button>
                  </div>
                )) : (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <CheckCircle size={32} color="var(--accent-emerald)" style={{ margin: '0 auto 8px auto' }} />
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>No Active Field Dispatches</div>
                    <div style={{ fontSize: '0.75rem', marginTop: 4 }}>All reported road hazards have been handled.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Action / Review Modal */}
      {selectedHazard && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div className="glass-panel" style={{
            width: '620px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 24,
            border: '1px solid var(--border-color-glow)',
            boxShadow: 'var(--shadow-glow)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="badge badge-warning">{selectedHazard.hazard_type.toUpperCase()}</span>
                <h3 style={{ fontSize: '1.25rem', marginTop: 8 }}>{selectedHazard.title}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Location: {selectedHazard.address || `${selectedHazard.latitude}, ${selectedHazard.longitude}`}
                </p>
              </div>
              <button
                onClick={() => setSelectedHazard(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: 16, padding: 12, borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Description & Driver Notes:</div>
              <p style={{ fontSize: '0.85rem', marginTop: 4 }}>{selectedHazard.description || 'Reported through computer vision road camera inference with high confidence.'}</p>
            </div>

            {/* Workflow Action Steps */}
            <div style={{ marginTop: 20 }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Resolution / Inspection Notes:
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Enter work order notes, dispatched crew details, or asphalt repair notes..."
                style={{
                  width: '100%',
                  height: 70,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 10,
                  color: 'var(--text-main)',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              />

              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginTop: 12, marginBottom: 6 }}>
                Resolution Proof Image URL (Required to verify fix):
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-fixed-road... or /uploads/..."
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--text-main)',
                    fontSize: '0.82rem',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setProofUrl('https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800')}
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                >
                  <Camera size={14} /> Demo Photo
                </button>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                {selectedHazard.status !== 'assigned' && selectedHazard.status !== 'in_progress' && (
                  <button
                    disabled={isUpdating}
                    onClick={() => handleStatusUpdate(selectedHazard.id, 'assigned')}
                    className="btn btn-outline"
                    style={{ flex: 1, padding: '10px 0', borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)' }}
                  >
                    <HardHat size={16} /> Assign Crew
                  </button>
                )}

                {selectedHazard.status !== 'in_progress' && (
                  <button
                    disabled={isUpdating}
                    onClick={() => handleStatusUpdate(selectedHazard.id, 'in_progress')}
                    className="btn btn-outline"
                    style={{ flex: 1, padding: '10px 0', borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }}
                  >
                    <Wrench size={16} /> In Progress
                  </button>
                )}

                <button
                  disabled={isUpdating}
                  onClick={() => handleStatusUpdate(selectedHazard.id, 'fixed')}
                  className="btn btn-success"
                  style={{ flex: 1, padding: '10px 0' }}
                >
                  <CheckCircle size={16} /> {isUpdating ? 'Submitting...' : 'Mark Fixed & Verified'}
                </button>
              </div>
            </div>

            {/* Audit History */}
            {selectedHazard.status_history && selectedHazard.status_history.length > 0 && (
              <div style={{ marginTop: 20, borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>Status History Audit Trail:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {selectedHazard.status_history.map(item => (
                    <div key={item.id} style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--accent-amber)' }}>{item.new_status.toUpperCase()}</span>
                      <span style={{ color: 'var(--text-dim)' }}> — {item.notes || 'Status changed'} ({new Date(item.created_at).toLocaleTimeString()})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

