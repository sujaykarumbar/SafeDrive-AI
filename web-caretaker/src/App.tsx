import React, { useState, useEffect } from 'react';
import { CaretakerSidebar } from './components/CaretakerSidebar';
import { CaretakerNavbar } from './components/CaretakerNavbar';
import { CaretakerDashboard } from './components/CaretakerDashboard';
import { setStoredToken, apiFetch, EmergencyIncident } from './api';

const CARETAKER_CREDS = {
  email: 'priya.caretaker@safedrive.ai',
  pass: 'SafeDrive@2026'
};

export const App: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<string>('dashboard');
  const [currentTab, setCurrentTab] = useState<'live_fleet' | 'risk_analytics' | 'trip_replay' | 'emergency'>('live_fleet');
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [emergenciesCount, setEmergenciesCount] = useState<number>(0);

  const authenticateCaretaker = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: CARETAKER_CREDS.email, password: CARETAKER_CREDS.pass })
      });
      if (res.ok) {
        const data = await res.json();
        setStoredToken(data.access_token);
        fetchEmergencyCount();
      }
    } catch (err) {
      console.warn('Backend offline, using fallback state.');
    }
  };

  const fetchEmergencyCount = async () => {
    try {
      const active: EmergencyIncident[] = await apiFetch('/emergency/active');
      setEmergenciesCount(active ? active.length : 0);
    } catch (e) {
      // offline
    }
  };

  useEffect(() => {
    authenticateCaretaker();
    const interval = setInterval(fetchEmergencyCount, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectSidebar = (menu: string) => {
    setActiveMenu(menu);
    setActiveView(menu);
    if (menu === 'dashboard' || menu === 'live_map') {
      setCurrentTab('live_fleet');
    } else if (menu === 'alerts') {
      setCurrentTab('emergency');
    } else if (menu === 'analytics') {
      setCurrentTab('risk_analytics');
    } else if (menu === 'reports') {
      setCurrentTab('trip_replay');
    }
  };

  const handleSelectTab = (tab: 'live_fleet' | 'risk_analytics' | 'trip_replay' | 'emergency') => {
    setCurrentTab(tab);
    if (tab === 'live_fleet') {
      setActiveView('dashboard');
      setActiveMenu('dashboard');
    } else if (tab === 'risk_analytics') {
      setActiveView('analytics');
      setActiveMenu('analytics');
    } else if (tab === 'trip_replay') {
      setActiveView('reports');
      setActiveMenu('reports');
    } else if (tab === 'emergency') {
      setActiveView('alerts');
      setActiveMenu('alerts');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-main)' }}>
      {/* 1. Left Sidebar */}
      <CaretakerSidebar
        activeMenu={activeMenu}
        onSelectMenu={handleSelectSidebar}
        alertCount={emergenciesCount}
      />

      {/* 2. Main Workspace */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>
        {/* Top Navbar */}
        <CaretakerNavbar
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          activeEmergenciesCount={emergenciesCount}
        />

        {/* Dynamic Pages */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <CaretakerDashboard
            currentTab={activeView}
            onSelectTab={(target) => {
              handleSelectSidebar(target);
            }}
          />
        </main>
      </div>
    </div>
  );
};

export default App;
