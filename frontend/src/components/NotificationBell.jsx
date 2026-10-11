import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const dotTone = {
  red: 'bg-rose-400',
  amber: 'bg-amber-400',
  green: 'bg-emerald-400',
  slate: 'bg-white/40',
};

export default function NotificationBell({ endpoint = '/notifications' }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  function load() {
    setLoading(true);
    api
      .get(endpoint)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggle() {
    setOpen((o) => {
      if (!o) load();
      return !o;
    });
  }

  function acknowledge(item) {
    setOpen(false);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    api.post(`${endpoint}/${encodeURIComponent(item.id)}/ack`).catch(() => {});
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={toggle}
        className="relative flex items-center justify-center h-9 w-9 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white"
        aria-label="Notifications"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
          <path
            d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {items.length > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-rose-500 text-white text-[10px] leading-4 font-semibold text-center">
            {items.length > 9 ? '9+' : items.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl bg-brand-gradient-diagonal border border-white/15 shadow-2xl z-50">
          <div className="px-4 py-3 border-b border-white/15 text-sm font-medium text-white">Notifications</div>
          {loading ? (
            <p className="p-4 text-sm text-white/60">Loading…</p>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-white/60">You're all caught up.</p>
          ) : (
            <div className="divide-y divide-white/10">
              {items.map((item) => (
                <Link
                  key={item.id}
                  to={item.link}
                  onClick={() => acknowledge(item)}
                  className="flex items-start gap-2.5 px-4 py-3 hover:bg-white/10 transition-colors"
                >
                  <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${dotTone[item.tone] || dotTone.slate}`} />
                  <span className="text-sm text-white/90">{item.message}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
