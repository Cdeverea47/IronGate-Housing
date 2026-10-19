import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Card, Button, Input, Textarea, Label, Select, ErrorText, PasswordInput } from '../components/UI.jsx';
import { GetPaidCard, PaymentMethodsCard } from '../components/PaymentSetupCards.jsx';
import PaymentPlanCard from '../components/PaymentPlanCard.jsx';

const PAYMENT_METHODS = [
  { value: 'card', label: 'Card (Stripe)' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'zelle', label: 'Zelle' },
];

function initials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');
}

export default function Profile() {
  const { user, updateUser, applySession } = useAuth();
  const isTenant = user?.role === 'tenant';
  const fileRef = useRef(null);

  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(null);

  function loadProfile() {
    api
      .get('/auth/me')
      .then(setProfile)
      .catch((err) => setError(err.message));
  }

  useEffect(loadProfile, []);

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const updated = await api.post('/auth/me/avatar', fd, { isForm: true });
      setProfile(updated);
      updateUser(updated);
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      setAvatarUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (error && !profile) return <p className="text-rose-200">{error}</p>;
  if (!profile) return <p className="text-white/60">Loading…</p>;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold text-white">Profile</h1>
        <p className="text-white/60 text-sm mt-1">Update your info and preferences</p>
      </div>

      <div className="flex items-center gap-4">
        {profile.avatar_data_url ? (
          <img
            src={profile.avatar_data_url}
            alt="Profile"
            className="h-16 w-16 rounded-full object-cover border border-white/20 shrink-0"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-lg font-semibold text-white shrink-0">
            {initials(profile.name)}
          </div>
        )}
        <div>
          <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} disabled={avatarUploading}>
            {avatarUploading ? 'Uploading…' : 'Change photo'}
          </Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          <ErrorText>{avatarError}</ErrorText>
        </div>
      </div>

      <div className="flex gap-1 border-b border-white/10">
        {[
          { key: 'profile', label: 'Profile' },
          { key: 'security', label: 'Login & Security' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-white text-white' : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <ProfileTab profile={profile} setProfile={setProfile} isTenant={isTenant} updateUser={updateUser} />
      ) : (
        <SecurityTab profile={profile} setProfile={setProfile} updateUser={updateUser} applySession={applySession} />
      )}

      <Card className="p-4 text-sm text-white/70">
        <Link to="/terms" target="_blank" className="underline text-white hover:text-white/90">
          Terms of Service & Privacy Policy
        </Link>
      </Card>
    </div>
  );
}

function ProfileTab({ profile, setProfile, isTenant, updateUser }) {
  const [name, setName] = useState(profile.name || '');
  const [paymentMethod, setPaymentMethod] = useState(profile.payment_method || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const body = { name };
      if (isTenant) {
        body.payment_method = paymentMethod || null;
      }
      const updated = await api.patch('/auth/me', body);
      setProfile(updated);
      updateUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={profile.email} disabled className="opacity-60" />
            <p className="text-xs text-white/50 mt-1">Change your email under Login & Security.</p>
          </div>

          {isTenant ? (
            <>
              <div className="pt-2 border-t border-white/10">
                <Label>Preferred secure payment method</Label>
                <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="">Not set</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>

            </>
          ) : null}

          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
          </Button>
        </form>
      </Card>

      {isTenant ? <PaymentMethodsCard /> : <GetPaidCard />}

      {isTenant ? <PaymentPlanCard /> : null}
    </div>
  );
}

function SecurityTab({ profile, setProfile, updateUser, applySession }) {
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailError, setEmailError] = useState(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState(null);

  const [twoFactorStep, setTwoFactorStep] = useState('idle'); // idle | code | disable
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [twoFactorError, setTwoFactorError] = useState(null);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);

  const [notifSaving, setNotifSaving] = useState(false);

  async function handleChangeEmail(e) {
    e.preventDefault();
    setEmailError(null);
    setEmailSaving(true);
    try {
      const data = await api.patch('/auth/me/email', { new_email: newEmail, password: emailPassword });
      applySession(data.token, data.user);
      setProfile(data.user);
      setNewEmail('');
      setEmailPassword('');
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2000);
    } catch (err) {
      setEmailError(err.message);
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaving(true);
    try {
      await api.patch('/auth/me/password', { current_password: currentPassword, new_password: newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2000);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleEnable2fa() {
    setTwoFactorError(null);
    setTwoFactorBusy(true);
    try {
      await api.post('/auth/me/2fa/enable');
      setTwoFactorStep('code');
    } catch (err) {
      setTwoFactorError(err.message);
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function handleConfirm2fa(e) {
    e.preventDefault();
    setTwoFactorError(null);
    setTwoFactorBusy(true);
    try {
      const updated = await api.post('/auth/me/2fa/confirm', { code: twoFactorCode });
      setProfile(updated);
      updateUser(updated);
      setTwoFactorStep('idle');
      setTwoFactorCode('');
    } catch (err) {
      setTwoFactorError(err.message);
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function handleDisable2fa(e) {
    e.preventDefault();
    setTwoFactorError(null);
    setTwoFactorBusy(true);
    try {
      const updated = await api.post('/auth/me/2fa/disable', { password: twoFactorPassword });
      setProfile(updated);
      updateUser(updated);
      setTwoFactorStep('idle');
      setTwoFactorPassword('');
    } catch (err) {
      setTwoFactorError(err.message);
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function toggleNotifications() {
    setNotifSaving(true);
    try {
      const updated = await api.patch('/auth/me', { email_notifications_enabled: !profile.email_notifications_enabled });
      setProfile(updated);
      updateUser(updated);
    } catch {
      // non-fatal
    } finally {
      setNotifSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <h3 className="text-sm font-medium text-white/90">Email address</h3>
        <form onSubmit={handleChangeEmail} className="space-y-3">
          <div>
            <Label>New email</Label>
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Current password (to confirm)</Label>
            <PasswordInput value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} required />
          </div>
          <ErrorText>{emailError}</ErrorText>
          <Button type="submit" variant="secondary" disabled={emailSaving}>
            {emailSaving ? 'Updating…' : emailSaved ? 'Updated ✓' : 'Update email'}
          </Button>
        </form>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="text-sm font-medium text-white/90">Password</h3>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <Label>Current password</Label>
            <PasswordInput value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div>
            <Label>New password</Label>
            <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
          </div>
          <ErrorText>{passwordError}</ErrorText>
          <Button type="submit" variant="secondary" disabled={passwordSaving}>
            {passwordSaving ? 'Updating…' : passwordSaved ? 'Updated ✓' : 'Update password'}
          </Button>
        </form>
        <p className="text-xs text-white/50">
          Forgot your current password?{' '}
          <Link to="/forgot-password" target="_blank" className="underline text-white/70 hover:text-white">
            Reset it by email
          </Link>
          .
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="text-sm font-medium text-white/90">Two-factor authentication</h3>
        <p className="text-xs text-white/50">
          When enabled, we'll email you a 6-digit code to enter each time you sign in.
        </p>

        {profile.two_factor_enabled ? (
          twoFactorStep === 'disable' ? (
            <form onSubmit={handleDisable2fa} className="space-y-3">
              <div>
                <Label>Confirm your password to disable</Label>
                <PasswordInput value={twoFactorPassword} onChange={(e) => setTwoFactorPassword(e.target.value)} required />
              </div>
              <ErrorText>{twoFactorError}</ErrorText>
              <div className="flex gap-2">
                <Button type="submit" variant="danger" disabled={twoFactorBusy}>
                  {twoFactorBusy ? 'Disabling…' : 'Disable 2FA'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setTwoFactorStep('idle')}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-emerald-300 font-medium">Enabled</span>
              <Button variant="danger" onClick={() => setTwoFactorStep('disable')}>
                Disable
              </Button>
            </div>
          )
        ) : twoFactorStep === 'code' ? (
          <form onSubmit={handleConfirm2fa} className="space-y-3">
            <p className="text-xs text-white/50">Enter the code we just emailed you.</p>
            <Input value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} maxLength={6} required />
            <ErrorText>{twoFactorError}</ErrorText>
            <div className="flex gap-2">
              <Button type="submit" disabled={twoFactorBusy}>
                {twoFactorBusy ? 'Confirming…' : 'Confirm & enable'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setTwoFactorStep('idle')}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="secondary" onClick={handleEnable2fa} disabled={twoFactorBusy}>
            {twoFactorBusy ? 'Sending code…' : 'Enable two-factor authentication'}
          </Button>
        )}
      </Card>

      <Card className="p-5 space-y-2">
        <h3 className="text-sm font-medium text-white/90">Email notifications</h3>
        <label className="flex items-center gap-2.5 text-sm text-white/80">
          <input
            type="checkbox"
            checked={!!profile.email_notifications_enabled}
            onChange={toggleNotifications}
            disabled={notifSaving}
            className="h-4 w-4 rounded border-white/30 bg-white/10 accent-white"
          />
          Send me email notifications (maintenance updates, lease renewals, etc.)
        </label>
        <p className="text-xs text-white/50">
          Turning this off won't affect essential emails like password resets or sign-in codes.
        </p>
      </Card>
    </div>
  );
}
