import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { errorMessage, tokenStore } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!tokenStore.access) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      // The admin panel has no purpose for a non-admin, so drop the session
      // rather than rendering an interface that will 403 on every request.
      if (data.role !== 'admin') {
        tokenStore.clear();
        setUser(null);
      } else {
        setUser(data);
      }
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('store:unauthorized', onUnauthorized);
    return () => window.removeEventListener('store:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    tokenStore.set(data);
    const { data: profile } = await api.get('/auth/me');
    if (profile.role !== 'admin') {
      tokenStore.clear();
      throw new Error('This account is not an administrator.');
    }
    setUser(profile);
    return profile;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Local logout must succeed regardless of API availability.
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, errorMessage }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
