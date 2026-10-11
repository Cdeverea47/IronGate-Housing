import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Button, AuthInput, AuthLabel, RoleToggle, ErrorText } from '../components/UI.jsx';
import { LogoBadge, Wordmark } from '../components/Logo.jsx';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('landlord');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email, role });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-1/2 bg-brand-gradient-diagonal text-white flex-col justify-between p-12">
        <div className="flex items-center gap-2.5">
          <LogoBadge size={36} />
          <span className="text-lg font-semibold tracking-tight">
            <Wordmark />
          </span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">Forgot your password?</h2>
          <p className="mt-4 text-white/80">No problem — we'll email you a link to choose a new one.</p>
        </div>
        <div className="text-sm text-white/60">© {new Date().getFullYear()} IronGate Housing</div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-soft p-8">
          {sent ? (
            <>
              <h1 className="text-xl font-semibold text-slate-900 mb-1">Check your email</h1>
              <p className="text-sm text-slate-500">
                If an account exists for <span className="font-medium text-slate-700">{email}</span>, we've sent a
                password reset link. It expires in 1 hour.
              </p>
              <p className="mt-4 text-xs text-slate-400">
                Tip: your username is the email address you signed up with — there's nothing else to remember.
              </p>
              <p className="mt-4 text-sm text-slate-500 text-center">
                <Link to="/login" className="text-brand-700 font-medium">
                  Back to sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-slate-900 mb-1">Reset your password</h1>
              <p className="text-sm text-slate-500 mb-6">
                Enter the email on your account and we'll send you a reset link.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <AuthLabel>Account type</AuthLabel>
                  <RoleToggle role={role} onChange={setRole} />
                </div>
                <div>
                  <AuthLabel>Email</AuthLabel>
                  <AuthInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <ErrorText light>{error}</ErrorText>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Sending…' : 'Send reset link'}
                </Button>
              </form>
              <p className="mt-4 text-xs text-slate-400">
                Tip: your username is the email address you signed up with — there's nothing else to remember.
              </p>
              <p className="mt-4 text-sm text-slate-500 text-center">
                Remembered it?{' '}
                <Link to="/login" className="text-brand-700 font-medium">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
