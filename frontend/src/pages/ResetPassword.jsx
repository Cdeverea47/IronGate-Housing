import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { Button, AuthLabel, ErrorText, PasswordInput } from '../components/UI.jsx';
import { LogoBadge, Wordmark } from '../components/Logo.jsx';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
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
          <h2 className="text-3xl font-semibold leading-tight">Choose a new password.</h2>
          <p className="mt-4 text-white/80">Pick something you haven't used before.</p>
        </div>
        <div className="text-sm text-white/60">© {new Date().getFullYear()} IronGate Housing</div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-soft p-8">
          {!token ? (
            <>
              <h1 className="text-xl font-semibold text-slate-900 mb-1">Invalid link</h1>
              <p className="text-sm text-slate-500">
                This reset link is missing its token. Request a new one from the{' '}
                <Link to="/forgot-password" className="text-brand-700 font-medium">
                  forgot password
                </Link>{' '}
                page.
              </p>
            </>
          ) : done ? (
            <>
              <h1 className="text-xl font-semibold text-slate-900 mb-1">Password updated</h1>
              <p className="text-sm text-slate-500">Taking you to sign in…</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-slate-900 mb-1">Choose a new password</h1>
              <p className="text-sm text-slate-500 mb-6">Make it at least 6 characters.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <AuthLabel>New password</AuthLabel>
                  <PasswordInput
                    light
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <AuthLabel>Confirm password</AuthLabel>
                  <PasswordInput
                    light
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <ErrorText light>{error}</ErrorText>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Updating…' : 'Update password'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
