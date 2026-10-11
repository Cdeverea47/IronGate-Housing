import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LogoBadge, Wordmark } from './Logo.jsx';
import NotificationBell from './NotificationBell.jsx';
import ProfileMenu from './ProfileMenu.jsx';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/payments', label: 'Payments' },
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
          <nav className="flex items-center gap-1 overflow-x-auto pb-3 -mx-1 px-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-white/20 text-white shadow-sm backdrop-blur-sm'
                      : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
