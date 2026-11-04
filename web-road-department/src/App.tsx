import React, { useState, useEffect } from 'react';
import { DepartmentNavbar } from './components/DepartmentNavbar';
import { DepartmentDashboard } from './components/DepartmentDashboard';
import { setStoredToken, apiFetch } from './api';

const OFFICER_CREDS = {
  email: 'officer.kumar@safedrive.ai',
  pass: 'SafeDrive@2026'
};

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'queue' | 'map' | 'analytics'>('queue');
  const [criticalCount, setCriticalCount] = useState<number>(0);

  const authenticateOfficer = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: OFFICER_CREDS.email, password: OFFICER_CREDS.pass })
      });
      if (res.ok) {
        const data = await res.json();
        setStoredToken(data.access_token);
        fetchMetrics();
      }
    } catch (err) {
      console.warn('Backend not yet reachable on http://localhost:8000, continuing...');
    }
  };

  const fetchMetrics = async () => {
    try {
      const metrics = await apiFetch('/department/metrics');
      if (metrics) {
        setCriticalCount(metrics.critical_unresolved || 0);
      }
    } catch (e) {
      // offline fallback
    }
  };

  useEffect(() => {
    authenticateOfficer();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <DepartmentNavbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        criticalCount={criticalCount}
      />

      <main style={{ flex: 1 }}>
        <DepartmentDashboard currentTab={currentTab} />
      </main>
    </div>
  );
};

export default App;

