import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, AuthInput, AuthLabel, ErrorText, PasswordInput } from '../components/UI.jsx';
import { AuthShell, RoleChooser } from '../components/AuthShell.jsx';

export default function Register() {
  const { register, loading, error } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [params] = useSearchParams();
  const [role, setRole] = useState(['landlord', 'tenant'].includes(params.get('role')) ? params.get('role') : null);
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

  if (!role) {
    return (
      <AuthShell>
        <RoleChooser title="Create your account" subtitle="First, tell us who you are." onChoose={setRole} />
        <p className="mt-6 text-sm text-slate-500 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-700 font-medium">
            Sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
          <h1 className="text-xl font-semibold text-slate-900 mb-1">Create your account</h1>
          <p className="text-sm text-slate-500 mb-6">
            {role === 'tenant' ? 'Track your rent and maintenance requests' : 'Start tracking your rental properties'}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {role === 'tenant' ? (
              <p className="text-xs text-slate-500">
                Use the same email your landlord has on file so your account links to your lease automatically.
              </p>
            ) : null}
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
            <Link to={`/login?role=${role}`} className="text-brand-700 font-medium">
              Sign in
            </Link>
          </p>
          <p className="mt-2 text-xs text-slate-400 text-center">
            Creating a {role} account.{' '}
            <button type="button" onClick={() => setRole(null)} className="underline hover:text-slate-600">
              Change
            </button>
          </p>
    </AuthShell>
  );
}
