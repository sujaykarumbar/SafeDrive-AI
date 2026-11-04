import React, { useState, useEffect } from 'react';
import {
  Users,
  ChevronDown,
  Radio,
  Activity,
  Clock,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

interface CaretakerNavbarProps {
  currentTab: 'live_fleet' | 'risk_analytics' | 'trip_replay' | 'emergency';
  onSelectTab: (tab: 'live_fleet' | 'risk_analytics' | 'trip_replay' | 'emergency') => void;
  activeEmergenciesCount: number;
}

export const CaretakerNavbar: React.FC<CaretakerNavbarProps> = ({
  currentTab,
  onSelectTab,
  activeEmergenciesCount
}) => {
  const [currentTime, setCurrentTime] = useState<string>('12:45 PM');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 28px',
      background: 'transparent',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      {/* Left: Dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          className="cyber-tab-pill"
          style={{
            padding: '10px 16px',
            background: 'rgba(15, 23, 42, 0.7)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            color: '#ffffff',
            gap: 10
          }}
        >
          <Users size={16} color="var(--text-cyan)" />
          <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>Fleet & Family Portal</span>
          <ChevronDown size={14} color="var(--text-muted)" />
        </button>
      </div>

      {/* Center: Glowing Pill Tabs */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(10, 18, 32, 0.75)',
        backdropFilter: 'blur(16px)',
        padding: '5px 8px',
        borderRadius: 'var(--radius-full)',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <button
          onClick={() => onSelectTab('live_fleet')}
          className={`cyber-tab-pill ${currentTab === 'live_fleet' ? 'active' : ''}`}
        >
          <Radio size={15} color={currentTab === 'live_fleet' ? '#00f0ff' : 'currentColor'} />
          <span>Live Fleet & Tracking</span>
        </button>

        <button
          onClick={() => onSelectTab('risk_analytics')}
          className={`cyber-tab-pill ${currentTab === 'risk_analytics' ? 'active' : ''}`}
        >
          <Activity size={15} color={currentTab === 'risk_analytics' ? '#00f0ff' : 'currentColor'} />
          <span>Risk AI & SHAP</span>
        </button>

        <button
          onClick={() => onSelectTab('trip_replay')}
          className={`cyber-tab-pill ${currentTab === 'trip_replay' ? 'active' : ''}`}
        >
          <Clock size={15} color={currentTab === 'trip_replay' ? '#00f0ff' : 'currentColor'} />
          <span>Historic Replay</span>
        </button>

        <button
          onClick={() => onSelectTab('emergency')}
          className={`cyber-tab-pill ${currentTab === 'emergency' ? 'active' : ''}`}
          style={{ position: 'relative' }}
        >
          <AlertTriangle size={15} color={currentTab === 'emergency' ? '#ef4444' : 'currentColor'} />
          <span>Emergency Interventions</span>
          {activeEmergenciesCount > 0 && (
            <span style={{
              background: '#ef4444',
              color: 'white',
              borderRadius: '50%',
              padding: '1px 6px',
              fontSize: '0.65rem',
              fontWeight: 800,
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.6)'
            }}>
              {activeEmergenciesCount}
            </span>
          )}
        </button>
      </nav>

      {/* Right: Live Clock & User Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* Live indicator & clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#ffffff' }}>
          <span className="pulse-green"></span>
          <span style={{ color: 'var(--neon-emerald)', fontWeight: 600 }}>Live</span>
          <span style={{ color: 'var(--text-muted)' }}>{currentTime}</span>
        </div>

        {/* User Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80"
            alt="Priya Sharma"
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid rgba(56, 189, 248, 0.4)',
              boxShadow: '0 0 12px rgba(6, 182, 212, 0.3)'
            }}
          />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>
              Priya Sharma
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Caretaker
            </div>
          </div>
        </div>

        {/* Quick jump to Road Dept portal */}
        <a
          href="http://localhost:5175"
          target="_blank"
          rel="noreferrer"
          title="Open Road Department Portal"
          className="cyber-tab-pill"
          style={{ padding: '6px 12px', fontSize: '0.72rem', color: 'var(--text-amber)', borderColor: 'rgba(245, 158, 11, 0.3)' }}
        >
          <ExternalLink size={13} /> Road Dept :5175
        </a>
      </div>
    </header>
  );
};
