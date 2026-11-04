import React, { useEffect, useState } from 'react';
import { Hazard, apiFetch } from '../api';
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
  ShieldAlert
} from 'lucide-react';

export const DepartmentDashboard: React.FC = () => {
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [metrics, setMetrics] = useState<any>({
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
  const [selectedHazard, setSelectedHazard] = useState<Hazard | null>(null);
  const [actionNotes, setActionNotes] = useState<string>('');
  const [proofUrl, setProofUrl] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

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

  const handleStatusUpdate = async (hazardId: number, newStatus: string) => {
    try {
      setIsUpdating(true);
      await apiFetch(`/hazards/${hazardId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          new_status: newStatus,
          notes: actionNotes || `Status updated to ${newStatus} by Road Maintenance Division`,
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
        return <span className="badge badge-warning">IN PROGRESS</span>;
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
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>Urgent hazard queue</p>
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
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>Dispatch to verified fix</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            {filteredHazards.map(h => (
              <tr
                key={h.id}
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  background: selectedHazard?.id === h.id ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
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
                    <MapPin size={14} color="var(--accent-cyan)" />
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
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  >
                    Manage Issue <ChevronRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
            width: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 24,
            border: '1px solid var(--border-color-glow)',
            boxShadow: 'var(--shadow-glow)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="badge badge-info">{selectedHazard.hazard_type.toUpperCase()}</span>
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
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Description:</div>
              <p style={{ fontSize: '0.85rem', marginTop: 4 }}>{selectedHazard.description || 'No additional description provided.'}</p>
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
                Resolution Proof Image URL (Required for Fixed):
              </label>
              <input
                type="text"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                placeholder="https://safedrive.ai/proofs/fixed_asphalt_01.jpg"
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 10px',
                  color: 'var(--text-main)',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button
                onClick={() => handleStatusUpdate(selectedHazard.id, 'assigned')}
                disabled={isUpdating}
                className="btn btn-outline"
              >
                Assign Work Crew
              </button>

              <button
                onClick={() => handleStatusUpdate(selectedHazard.id, 'in_progress')}
                disabled={isUpdating}
                className="btn btn-primary"
              >
                <Wrench size={15} /> Mark In Progress
              </button>

              <button
                onClick={() => handleStatusUpdate(selectedHazard.id, 'fixed')}
                disabled={isUpdating}
                className="btn btn-primary"
                style={{ background: 'var(--gradient-success)' }}
              >
                <CheckCircle size={15} /> Mark Fixed & Verified
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
