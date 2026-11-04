import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CaretakerDashboard } from './components/CaretakerDashboard';
import { DepartmentDashboard } from './components/DepartmentDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { DriverSimulatorModal } from './components/DriverSimulatorModal';
import { setStoredToken } from './api';

const DEMO_CREDENTIALS: Record<string, { email: string; pass: string }> = {
  caretaker: { email: 'priya.caretaker@safedrive.ai', pass: 'SafeDrive@2026' },
  officer: { email: 'officer.kumar@safedrive.ai', pass: 'SafeDrive@2026' },
  admin: { email: 'admin@safedrive.ai', pass: 'SafeDrive@2026' },
  driver: { email: 'rahul.driver@safedrive.ai', pass: 'SafeDrive@2026' }
};

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'caretaker' | 'department' | 'admin' | 'simulator'>('caretaker');
  const [activeUserRole, setActiveUserRole] = useState<string>('caretaker');

  const authenticateAs = async (role: string) => {
    const creds = DEMO_CREDENTIALS[role];
    if (!creds) return;

    try {
      const res = await fetch('http://localhost:8000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: creds.email, password: creds.pass })
      });
      if (res.ok) {
        const data = await res.json();
        setStoredToken(data.access_token);
        setActiveUserRole(role);
      }
    } catch (err) {
      console.warn('Backend not yet reachable on http://localhost:8000, continuing...');
    }
  };

  useEffect(() => {
    // Initial login as Caretaker
    authenticateAs('caretaker');
  }, []);

  const handleRoleChange = (role: string) => {
    authenticateAs(role);
    if (role === 'caretaker') setCurrentTab('caretaker');
    else if (role === 'officer') setCurrentTab('department');
    else if (role === 'admin') setCurrentTab('admin');
    else if (role === 'driver') setCurrentTab('simulator');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        activeUser={activeUserRole}
        onSwitchUser={handleRoleChange}
      />

      <main style={{ flex: 1 }}>
        {currentTab === 'caretaker' && <CaretakerDashboard />}
        {currentTab === 'department' && <DepartmentDashboard />}
        {currentTab === 'admin' && <AdminDashboard />}
        {currentTab === 'simulator' && <DriverSimulatorModal />}
      </main>
    </div>
  );
};

export default App;
