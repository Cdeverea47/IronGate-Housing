import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

function initials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');
}

// Shared header dropdown for both the landlord and tenant layouts: shows the
// user's avatar + name, and opens a menu with Edit profile, Terms &
// policies, and Sign out.
export default function ProfileMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/10 transition-colors"
      >
        {user?.avatar_data_url ? (
          <img src={user.avatar_data_url} alt="" className="h-7 w-7 rounded-full object-cover border border-white/20" />
        ) : (
          <span className="h-7 w-7 rounded-full bg-white/20 border border-white/20 flex items-center justify-center text-[11px] font-semibold text-white">
            {initials(user?.name)}
          </span>
        )}
        <span className="hidden md:inline text-white/90 font-medium truncate max-w-[8rem]">{user?.name}</span>
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-white/60">
          <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-48 rounded-xl bg-brand-gradient-diagonal border border-white/15 shadow-2xl z-50 overflow-hidden">
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 transition-colors"
          >
            Edit profile
          </Link>
          <Link
            to="/terms"
            target="_blank"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 transition-colors"
          >
            Terms & policies
          </Link>
          <Link
            to="/help"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 transition-colors"
          >
            Help
          </Link>
          <button
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="block w-full text-left px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 transition-colors border-t border-white/10"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
