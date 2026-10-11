import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, AuthInput, AuthLabel, RoleToggle, ErrorText, PasswordInput } from '../components/UI.jsx';
import { LogoBadge, Wordmark } from '../components/Logo.jsx';

export default function Login() {
  const { login, loading, error, roleChoice, setRoleChoice, twoFactorChallenge, setTwoFactorChallenge, verifyTwoFactor } =
    useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('landlord');
  const [code, setCode] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const ok = await login(email, password, role);
    if (ok) navigate('/');
  }

  async function chooseRole(role) {
    const ok = await login(roleChoice.email, roleChoice.password, role);
    if (ok) navigate('/');
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    const ok = await verifyTwoFactor(code);
    if (ok) navigate('/');
  }

  useEffect(() => () => setRoleChoice(null), [setRoleChoice]);
  useEffect(() => () => setTwoFactorChallenge(null), [setTwoFactorChallenge]);

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
          <h2 className="text-3xl font-semibold leading-tight">Run your rental portfolio from one place.</h2>
          <p className="mt-4 text-white/80">
            Properties, tenants, leases, rent, maintenance, and documents — all tracked in one clean dashboard.
          </p>
        </div>
        <div className="text-sm text-white/60">© {new Date().getFullYear()} IronGate Housing</div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-soft p-8">
          {twoFactorChallenge ? (
            <>
              <h1 className="text-xl font-semibold text-slate-900 mb-1">Verify it's you</h1>
              <p className="text-sm text-slate-500 mb-6">
                We sent a 6-digit code to {twoFactorChallenge.email}. Enter it below to finish signing in.
              </p>
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <AuthLabel>Verification code</AuthLabel>
                  <AuthInput
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    maxLength={6}
                    required
                  />
                </div>
                <ErrorText light>{error}</ErrorText>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Verifying…' : 'Verify & sign in'}
                </Button>
              </form>
              <button
                type="button"
                onClick={() => setTwoFactorChallenge(null)}
                className="mt-4 text-sm text-slate-500 hover:text-slate-700 underline"
              >
                Back
              </button>
            </>
          ) : roleChoice ? (
            <>
              <h1 className="text-xl font-semibold text-slate-900 mb-1">Which account?</h1>
              <p className="text-sm text-slate-500 mb-6">
                This email has both a landlord and a tenant account. Which one do you want to sign into?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {roleChoice.roles.includes('landlord') ? (
                  <Button variant="secondary" onClick={() => chooseRole('landlord')} disabled={loading}>
                    Landlord
                  </Button>
                ) : null}
                {roleChoice.roles.includes('tenant') ? (
                  <Button variant="secondary" onClick={() => chooseRole('tenant')} disabled={loading}>
                    Tenant
                  </Button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setRoleChoice(null)}
                className="mt-4 text-sm text-slate-500 hover:text-slate-700 underline"
              >
                Back
              </button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-slate-900 mb-1">Welcome back</h1>
              <p className="text-sm text-slate-500 mb-6">
                {role === 'tenant' ? 'Sign in to view your lease and pay rent' : 'Sign in to manage your properties'}
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <AuthLabel>I am a…</AuthLabel>
                  <RoleToggle role={role} onChange={setRole} />
                </div>
                <div>
                  <AuthLabel>Email</AuthLabel>
                  <AuthInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <AuthLabel>Password</AuthLabel>
                    <Link to="/forgot-password" className="text-xs font-medium text-brand-700">
                      Forgot password?
                    </Link>
                  </div>
                  <PasswordInput light value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <ErrorText light>{error}</ErrorText>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
              <p className="mt-4 text-sm text-slate-500 text-center">
                No account?{' '}
                <Link to="/register" className="text-brand-700 font-medium">
                  Create one
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
