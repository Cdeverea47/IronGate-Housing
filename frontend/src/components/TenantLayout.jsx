import React from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from './NavBar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { LogoBadge, Wordmark } from './Logo.jsx';
import NotificationBell from './NotificationBell.jsx';
import ProfileMenu from './ProfileMenu.jsx';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  {
    label: 'Payments',
    children: [
      { to: '/payments', label: 'Payments' },
      { to: '/insurance', label: 'Rental insurance' },
    ],
  },
  { to: '/maintenance', label: 'Maintenance' },
  { to: '/documents', label: 'Documents' },
];

export default function TenantLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-gradient-diagonal bg-fixed text-white">
      <header className="shrink-0 bg-white/10 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-5xl mx-auto px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3 shrink-0">
              <LogoBadge size={56} />
              <span className="text-xl font-semibold tracking-tight leading-tight whitespace-nowrap">
                <Wordmark />
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm shrink-0">
              <NotificationBell endpoint="/portal/notifications" />
              <ProfileMenu user={user} onLogout={handleLogout} />
            </div>
          </div>
          <NavBar items={links} />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
