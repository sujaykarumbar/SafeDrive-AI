import React from 'react';
import {
  Shield,
  LayoutDashboard,
  MapPin,
  Users,
  Car,
  Bell,
  FileText,
  BarChart2,
  Eye,
  Sliders,
  Sparkles
} from 'lucide-react';

interface CaretakerSidebarProps {
  activeMenu: string;
  onSelectMenu: (menu: string) => void;
  alertCount?: number;
}

export const CaretakerSidebar: React.FC<CaretakerSidebarProps> = ({
  activeMenu,
  onSelectMenu,
  alertCount = 0
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'live_map', label: 'Live Map', icon: MapPin },
    { id: 'drivers', label: 'Drivers', icon: Users },
    { id: 'fleet', label: 'Fleet', icon: Car },
    { id: 'alerts', label: 'Alerts', icon: Bell, badge: alertCount > 0 ? alertCount : undefined },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'roadwatch', label: 'RoadWatch', icon: Eye },
    { id: 'settings', label: 'Settings', icon: Sliders }
  ];

  
  return (
    <aside style={{
      width: 220,
      background: 'rgba(7, 13, 24, 0.95)',
      backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(255, 255, 255, 0.06)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '24px 16px',
      height: '100vh',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Top: Logo & Brand */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 4, marginBottom: 32 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(59, 130, 246, 0.35) 100%)',
            border: '1px solid var(--neon-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(6, 182, 212, 0.4), inset 0 0 10px rgba(6, 182, 212, 0.3)'
          }}>
            <Shield size={24} color="#00f0ff" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.15rem', color: '#ffffff', letterSpacing: '-0.02em' }}>
              SafeDrive AI
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
              Caretaker Portal
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectMenu(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: isActive ? '1px solid var(--neon-cyan)' : '1px solid transparent',
                  background: isActive ? 'rgba(6, 182, 212, 0.14)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isActive ? '0 0 15px rgba(6, 182, 212, 0.3), inset 0 0 8px rgba(6, 182, 212, 0.15)' : 'none',
                  outline: 'none',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Icon size={18} color={isActive ? '#00f0ff' : 'currentColor'} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span style={{
                    background: '#ef4444',
                    color: 'white',
                    borderRadius: '50%',
                    padding: '1px 6px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)'
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Promo Card: "Drive Safe. Together." */}
      <div style={{
        background: 'linear-gradient(160deg, rgba(15, 23, 42, 0.9) 0%, rgba(6, 182, 212, 0.15) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: 16,
        padding: '16px 14px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.3 }}>
            Drive Safe.<br />Together.
          </h4>
        </div>

        {/* Futuristic vehicle preview graphic */}
        <div style={{ marginTop: 12, position: 'relative', height: 75, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img
            src="https://images.unsplash.com/photo-1617788138017-80ad40651399?w=300&auto=format&fit=crop&q=80"
            alt="Safe Vehicle"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: 10,
              filter: 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.5))'
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: -4,
            left: '10%',
            right: '10%',
            height: 10,
            background: '#00f0ff',
            filter: 'blur(8px)',
            opacity: 0.8
          }}></div>
        </div>
      </div>
    </aside>
  );
};

