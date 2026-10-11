import React, { useState } from 'react';

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 shadow-lg shadow-black/5 ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub }) {
  return (
    <Card className="p-5 transition-colors hover:bg-white/15">
      <div className="text-xs font-medium text-white/60 uppercase tracking-wide">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold text-white">{value}</div>
      {sub ? <div className="mt-1 text-xs text-white/50">{sub}</div> : null}
    </Card>
  );
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-white text-brand-700 shadow-sm hover:bg-white/90 active:bg-white/80',
    secondary: 'bg-white/15 text-white hover:bg-white/25',
    danger: 'bg-rose-500/20 text-rose-100 hover:bg-rose-500/30',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

// Same look as Button, but renders an <a> — for actions like "email
// landlord" (mailto:) that should be a real link, not a JS-only click handler.
export function LinkButton({ children, variant = 'primary', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all';
  const variants = {
    primary: 'bg-white text-brand-700 shadow-sm hover:bg-white/90 active:bg-white/80',
    secondary: 'bg-white/15 text-white hover:bg-white/25',
  };
  return (
    <a className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </a>
  );
}

export function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-white/20 bg-white/10 px-3.5 py-2.5 text-sm text-white placeholder-white/40 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 ${props.className || ''}`}
    />
  );
}

export function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-white/20 bg-white/10 px-3.5 py-2.5 text-sm text-white placeholder-white/40 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 ${props.className || ''}`}
    />
  );
}

export function Select(props) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-white/20 bg-white/10 px-3.5 py-2.5 text-sm text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 [&>option]:text-slate-900 ${props.className || ''}`}
    >
      {props.children}
    </select>
  );
}

export function Label({ children }) {
  return <label className="block text-xs font-medium text-white/70 mb-1.5">{children}</label>;
}

// Light-background variants of Input/Label, for the auth pages (Login/Register)
// where the form sits on a white card rather than the app's dark glass theme.
export function AuthInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${props.className || ''}`}
    />
  );
}

export function AuthLabel({ children }) {
  return <label className="block text-xs font-medium text-slate-700 mb-1.5">{children}</label>;
}

const EyeIcon = (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
    <path
      d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const EyeOffIcon = (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
    <path
      d="M2.5 2.5l15 15M8.3 8.4a2.5 2.5 0 0 0 3.4 3.4M6.2 6.3C3.7 7.6 2 10 2 10s3 6 8 6c1.4 0 2.6-.4 3.7-1.1M14 5c2.8 1.4 4 5 4 5s-.6 1.4-1.9 2.8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// A password field with a show/hide (eye) toggle — used at login, at
// signup, on the reset-password page, and anywhere a "current password"
// confirmation is required (e.g. Profile > Login & Security). `light`
// switches to the same styling as AuthInput for the light-background auth
// pages; otherwise it matches the dark glass-theme Input.
export function PasswordInput({ className = '', light = false, ...props }) {
  const [show, setShow] = useState(false);
  const Field = light ? AuthInput : Input;
  return (
    <div className="relative">
      <Field type={show ? 'text' : 'password'} className={`pr-10 ${className}`} {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors ${
          light ? 'text-slate-400 hover:text-slate-600' : 'text-white/50 hover:text-white/80'
        }`}
      >
        {show ? EyeOffIcon : EyeIcon}
      </button>
    </div>
  );
}

// Landlord/Tenant switch used on the auth pages (Login, Register, Forgot password).
export function RoleToggle({ role, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {['landlord', 'tenant'].map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`rounded-lg border px-3.5 py-2.5 text-sm font-medium capitalize transition-colors ${
            role === r
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

export function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-white/15 text-white/80',
    green: 'bg-emerald-400/20 text-emerald-200',
    red: 'bg-rose-400/20 text-rose-200',
    amber: 'bg-amber-400/20 text-amber-200',
    blue: 'bg-white/20 text-white',
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
      <div className="bg-brand-gradient-diagonal rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-white/15">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/15">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ message, action }) {
  return (
    <Card className="p-12 text-center text-white/60">
      <p>{message}</p>
      {action}
    </Card>
  );
}

export function ErrorText({ children, light = false }) {
  if (!children) return null;
  return <p className={`text-sm ${light ? 'text-rose-600' : 'text-rose-200'}`}>{children}</p>;
}
