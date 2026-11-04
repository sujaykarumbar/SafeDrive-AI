import React from 'react';
import { Shield, Radio, AlertTriangle, Users, Navigation, Sliders, ExternalLink } from 'lucide-react';

interface NavbarProps {
  currentTab: 'caretaker' | 'department' | 'admin' | 'simulator';
  onSelectTab: (tab: 'caretaker' | 'department' | 'admin' | 'simulator') => void;
  activeUser: string;
  onSwitchUser: (role: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  activeUser,
  onSwitchUser
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
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'var(--gradient-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
        }}>
          <Shield size={24} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.03em' }}>
              SafeDrive <span style={{ color: 'var(--accent-cyan)' }}>AI</span>
            </span>
            <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>Core v1.0</span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Smart Driver Safety & Road Hazard Intelligence</p>
        </div>
      </div>

      {/* Tabs */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.25)', padding: 4, borderRadius: 'var(--radius-sm)' }}>
        <button
          onClick={() => onSelectTab('caretaker')}
          className={`btn ${currentTab === 'caretaker' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
        >
          <Radio size={16} /> Caretaker Fleet
        </button>

        <button
          onClick={() => onSelectTab('department')}
          className={`btn ${currentTab === 'department' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
        >
          <AlertTriangle size={16} /> Road Dept Portal
        </button>

        <button
          onClick={() => onSelectTab('admin')}
          className={`btn ${currentTab === 'admin' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
        >
          <Sliders size={16} /> Admin & Audit
        </button>

        <button
          onClick={() => onSelectTab('simulator')}
          className={`btn ${currentTab === 'simulator' ? 'btn-danger' : 'btn-outline'}`}
          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
        >
          <Navigation size={16} /> Driver Simulator
        </button>
      </nav>

      {/* Demo Switcher & Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <a
            href="http://localhost:5174"
            target="_blank"
            rel="noreferrer"
            title="Launch Dedicated Caretaker Portal"
            className="btn btn-outline"
            style={{ padding: '4px 8px', fontSize: '0.72rem', color: 'var(--accent-cyan)', borderColor: 'rgba(6, 182, 212, 0.3)' }}
          >
            <ExternalLink size={12} /> Caretaker :5174
          </a>
          <a
            href="http://localhost:5175"
            target="_blank"
            rel="noreferrer"
            title="Launch Dedicated Road Department Portal"
            className="btn btn-outline"
            style={{ padding: '4px 8px', fontSize: '0.72rem', color: 'var(--accent-amber)', borderColor: 'rgba(245, 158, 11, 0.3)' }}
          >
            <ExternalLink size={12} /> Road Dept :5175
          </a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span className="pulse-indicator"></span>
          <span>Live Gateway</span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '6px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)'
        }}>
          <Users size={16} color="var(--accent-blue)" />
          <select
            value={activeUser}
            onChange={(e) => onSwitchUser(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-main)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="caretaker" style={{ background: '#111827' }}>Priya (Caretaker)</option>
            <option value="officer" style={{ background: '#111827' }}>Inspector Kumar (Road Dept)</option>
            <option value="admin" style={{ background: '#111827' }}>Administrator</option>
            <option value="driver" style={{ background: '#111827' }}>Rahul (Driver)</option>
          </select>
        </div>
      </div>
    </header>
  );
};
