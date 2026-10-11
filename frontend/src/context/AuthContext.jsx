import React, { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [roleChoice, setRoleChoice] = useState(null);
  const [twoFactorChallenge, setTwoFactorChallenge] = useState(null);

  // After login/register we only get the bare {id,name,email,role} back (kept
  // small since it's also the JWT payload), so fetch the fuller profile
  // (avatar, payment plan, etc.) right after to populate the header/profile
  // page without a second round trip later.
  async function persistSession(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    try {
      const full = await api.get('/auth/me');
      localStorage.setItem('user', JSON.stringify(full));
      setUser(full);
    } catch {
      // non-fatal — the bare user object still works for routing/display
    }
  }

  const login = useCallback(async (email, password, role) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.post('/auth/login', { email, password, role });
      if (data.needsRoleSelection) {
        setRoleChoice({ email, password, roles: data.roles });
        return false;
      }
      if (data.needsTwoFactor) {
        setTwoFactorChallenge({ email: data.email, role: data.role });
        return false;
      }
      setRoleChoice(null);
      await persistSession(data.token, data.user);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyTwoFactor = useCallback(
    async (code) => {
      if (!twoFactorChallenge) return false;
      setLoading(true);
      setError(null);
      try {
        const data = await api.post('/auth/login/verify-2fa', { ...twoFactorChallenge, code });
        setTwoFactorChallenge(null);
        await persistSession(data.token, data.user);
        return true;
      } catch (err) {
        setError(err.message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [twoFactorChallenge]
  );

  const register = useCallback(async (name, email, password, role, acceptTerms) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.post('/auth/register', { name, email, password, role, accept_terms: acceptTerms });
      await persistSession(data.token, data.user);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  // Merges a partial update (e.g. a new avatar or name) into the current
  // user object, so the header/profile page reflect changes immediately
  // without requiring a re-login.
  const updateUser = useCallback((partial) => {
    setUser((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  }, []);

  // Used after changing email, since that also re-issues the JWT (the email
  // is part of its payload) — swaps in the new token + full user object
  // directly, no extra /me round trip needed since the endpoint already
  // returns the full profile.
  const applySession = useCallback((token, updatedUser) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        updateUser,
        applySession,
        verifyTwoFactor,
        twoFactorChallenge,
        setTwoFactorChallenge,
        loading,
        error,
        roleChoice,
        setRoleChoice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
