import React from 'react';
import { AlertTriangle, Map, Wrench, BarChart2, ShieldCheck, ExternalLink, HardHat } from 'lucide-react';

interface DepartmentNavbarProps {
  currentTab: 'queue' | 'map' | 'analytics';
  onSelectTab: (tab: 'queue' | 'map' | 'analytics') => void;
  criticalCount: number;
}

export const DepartmentNavbar: React.FC<DepartmentNavbarProps> = ({
  currentTab,
  onSelectTab,
  criticalCount
}) => {
  return (
    <header className="glass-panel" style={{
      margin: '12px 16px',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 12,
      zIndex: 1000
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)'
        }}>
          <AlertTriangle size={24} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.03em' }}>
              SafeDrive <span style={{ color: 'var(--accent-amber)' }}>Road Dept</span>
            </span>
            <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Municipal Public Works</span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Hazard Triage • Crew Dispatch • Photo-Verified Road Repairs</p>
        </div>
      </div>

      {/* Tabs */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 'var(--radius-sm)' }}>
        <button
          onClick={() => onSelectTab('queue')}
          className={`btn ${currentTab === 'queue' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
        >
          <Wrench size={16} /> Hazard Triage Queue
          {criticalCount > 0 && (
            <span style={{
              background: '#ef4444',
              color: 'white',
              borderRadius: '50%',
              padding: '1px 6px',
              fontSize: '0.68rem',
              fontWeight: 800,
              marginLeft: 4
            }}>
              {criticalCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onSelectTab('map')}
          className={`btn ${currentTab === 'map' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
        >
          <Map size={16} /> GIS Road Hazard Map
        </button>

        <button
          onClick={() => onSelectTab('analytics')}
          className={`btn ${currentTab === 'analytics' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
        >
          <BarChart2 size={16} /> Resolution Metrics & SLA
        </button>
      </nav>

      {/* Profile & Switch to Caretaker Portal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span className="pulse-indicator"></span>
          <span>Field Dispatch Active</span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '6px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'var(--accent-amber)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            color: '#0b0f19'
          }}>
            <HardHat size={16} color="#0b0f19" />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Inspector Kumar</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Road Maintenance Division</div>
          </div>
        </div>

        <a
          href="http://localhost:5174"
          target="_blank"
          rel="noreferrer"
          title="Open Caretaker Portal"
          className="btn btn-outline"
          style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--accent-cyan)', borderColor: 'rgba(6, 182, 212, 0.3)' }}
        >
          <ExternalLink size={14} /> Caretaker Portal
        </a>
      </div>
    </header>
  );
};

