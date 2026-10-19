import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, AuthInput, AuthLabel, ErrorText, PasswordInput } from '../components/UI.jsx';
import { AuthShell, RoleChooser } from '../components/AuthShell.jsx';

export default function Login() {
  const { login, loading, error, roleChoice, setRoleChoice, twoFactorChallenge, setTwoFactorChallenge, verifyTwoFactor } =
    useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [params] = useSearchParams();
  const initialRole = ['landlord', 'tenant'].includes(params.get('role')) ? params.get('role') : null;
  const [role, setRole] = useState(initialRole);
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
    <AuthShell>
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
          ) : !role ? (
            <RoleChooser title="Welcome to IronGate Housing" subtitle="First, tell us who you are." onChoose={setRole} />
          ) : (
            <>
              <h1 className="text-xl font-semibold text-slate-900 mb-1">Welcome back</h1>
              <p className="text-sm text-slate-500 mb-6">
                {role === 'tenant' ? 'Sign in to view your lease and pay rent' : 'Sign in to manage your properties'}
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                <Link to={`/register?role=${role}`} className="text-brand-700 font-medium">
                  Create one
                </Link>
              </p>
              <p className="mt-2 text-xs text-slate-400 text-center">
                Signing in as a {role}.{' '}
                <button type="button" onClick={() => setRole(null)} className="underline hover:text-slate-600">
                  Change
                </button>
              </p>
            </>
          )}
    </AuthShell>
  );
}
