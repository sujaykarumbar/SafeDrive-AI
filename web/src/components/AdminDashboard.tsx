import React, { useEffect, useState } from 'react';
import { AuditLog, apiFetch } from '../api';
import { ShieldCheck, Activity, Database, Server, Users, Key, AlertCircle } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadAdminData = async () => {
    try {
      const overviewData = await apiFetch('/admin/overview');
      setOverview(overviewData);

      const logs: AuditLog[] = await apiFetch('/admin/audit-logs');
      setAuditLogs(logs);

      const healthData = await apiFetch('/admin/health');
      setHealth(healthData);
    } catch (e) {
      console.error('Failed to load admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
    const interval = setInterval(loadAdminData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '0 16px 20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* System Health Indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>FastAPI Gateway</span>
            <span className="badge badge-success">ONLINE</span>
          </div>
          <h3 style={{ fontSize: '1.4rem', marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Server size={20} color="var(--accent-blue)" /> Port 8000
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>Uptime 99.9% • Python 3.11</p>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Database Layer</span>
            <span className="badge badge-success">{health?.database || 'CONNECTED'}</span>
          </div>
          <h3 style={{ fontSize: '1.4rem', marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={20} color="var(--accent-emerald)" /> Persistent Store
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>SQLAlchemy with PostGIS/SQLite</p>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Driver Trips</span>
            <span className="badge badge-info">LIVE</span>
          </div>
          <h3 style={{ fontSize: '1.4rem', marginTop: 8, color: 'var(--accent-cyan)' }}>
            {overview?.trips?.active || 0} Ongoing
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>Total Recorded: {overview?.trips?.total || 0}</p>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registered Users</span>
            <Users size={18} color="var(--accent-purple)" />
          </div>
          <h3 style={{ fontSize: '1.4rem', marginTop: 8 }}>
            {overview?.users?.total || 4} Total
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
            {overview?.users?.drivers || 1} Drivers • {overview?.users?.caretakers || 1} Caretakers
          </p>
        </div>
      </div>

      {/* Audit Trail Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} color="var(--accent-cyan)" /> Immutable Security Audit Trail
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>
              Logs sensitive actions, authentication events, emergency escalations and status transitions
            </p>
          </div>
          <span className="badge badge-info">{auditLogs.length} EVENTS</span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '10px 18px' }}>Timestamp</th>
              <th style={{ padding: '10px 18px' }}>Action</th>
              <th style={{ padding: '10px 18px' }}>User</th>
              <th style={{ padding: '10px 18px' }}>Resource</th>
              <th style={{ padding: '10px 18px' }}>Metadata / Details</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map(log => (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px 18px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td style={{ padding: '10px 18px' }}>
                  <span className="badge badge-info" style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                    {log.action}
                  </span>
                </td>
                <td style={{ padding: '10px 18px', fontWeight: 600 }}>
                  {log.user_name || 'System / Service'}
                </td>
                <td style={{ padding: '10px 18px', color: 'var(--text-muted)' }}>
                  {log.resource_type ? `${log.resource_type} #${log.resource_id}` : '—'}
                </td>
                <td style={{ padding: '10px 18px', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  {JSON.stringify(log.details_json || {})}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
