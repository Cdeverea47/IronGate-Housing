import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, AuthInput, AuthLabel, RoleToggle, ErrorText, PasswordInput } from '../components/UI.jsx';
import { LogoBadge, Wordmark } from '../components/Logo.jsx';

export default function Register() {
  const { register, loading, error } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('landlord');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsError, setTermsError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!acceptTerms) {
      setTermsError('Please agree to the Terms of Service and Privacy Policy to continue');
      return;
    }
    setTermsError(null);
    const ok = await register(name, email, password, role, acceptTerms);
    if (ok) navigate('/');
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
          <h2 className="text-3xl font-semibold leading-tight">Get set up in a couple of minutes.</h2>
          <p className="mt-4 text-white/80">
            Add your properties and units, invite no one, track everything yourself — it's built for solo landlords.
          </p>
        </div>
        <div className="text-sm text-white/60">© {new Date().getFullYear()} IronGate Housing</div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-soft p-8">
          <h1 className="text-xl font-semibold text-slate-900 mb-1">Create your account</h1>
          <p className="text-sm text-slate-500 mb-6">
            {role === 'tenant' ? 'Track your rent and maintenance requests' : 'Start tracking your rental properties'}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <AuthLabel>I am a…</AuthLabel>
              <RoleToggle role={role} onChange={setRole} />
              {role === 'tenant' ? (
                <p className="mt-2 text-xs text-slate-500">
                  Use the same email your landlord has on file so your account links to your lease automatically.
                </p>
              ) : null}
            </div>
            <div>
              <AuthLabel>Full name</AuthLabel>
              <AuthInput value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <AuthLabel>Email</AuthLabel>
              <AuthInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <AuthLabel>Password</AuthLabel>
              <PasswordInput light value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <label className="flex items-start gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => {
                  setAcceptTerms(e.target.checked);
                  if (e.target.checked) setTermsError(null);
                }}
                className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300"
              />
              <span>
                I agree to the{' '}
                <Link to="/terms" target="_blank" className="text-brand-700 font-medium underline">
                  Terms of Service and Privacy Policy
                </Link>
              </span>
            </label>
            <ErrorText light>{termsError || error}</ErrorText>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
          <p className="mt-4 text-sm text-slate-500 text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
