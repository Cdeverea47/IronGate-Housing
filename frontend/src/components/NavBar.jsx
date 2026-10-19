import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const baseClass = 'shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors whitespace-nowrap';
const activeClass = 'bg-white/20 text-white shadow-sm backdrop-blur-sm';
const idleClass = 'text-white/75 hover:bg-white/10 hover:text-white';

function ChevronDown({ open }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function isPathActive(pathname, to, end) {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function Dropdown({ item }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();
  const childActive = item.children.some((c) => isPathActive(pathname, c.to, c.end));

  // Close when the route changes or the user clicks elsewhere.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${baseClass} inline-flex items-center gap-1 ${childActive ? activeClass : idleClass}`}
      >
        {item.label}
        <ChevronDown open={open} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 z-50 min-w-[11rem] rounded-xl border border-white/15 bg-slate-900/80 backdrop-blur-xl shadow-lg p-1"
        >
          {item.children.map((c) => (
            <NavLink
              key={c.to}
              to={c.to}
              end={c.end}
              role="menuitem"
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                  isActive ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {c.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Top navigation. An item is either a plain link ({ to, label, end? }) or a
// dropdown ({ label, children: [{ to, label }] }).
export default function NavBar({ items }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 pb-3 -mx-1 px-1">
      {items.map((item) =>
        item.children ? (
          <Dropdown key={item.label} item={item} />
        ) : (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `${baseClass} ${isActive ? activeClass : idleClass}`}
          >
            {item.label}
          </NavLink>
        )
      )}
    </nav>
  );
}
