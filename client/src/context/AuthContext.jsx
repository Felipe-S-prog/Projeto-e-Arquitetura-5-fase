
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../services/api';
import { clearAuthSession, getRefreshToken, saveAuthSession } from '../services/authStorage';

const AuthContext = createContext(null);

function deviceName() {
  return typeof navigator === 'undefined' ? 'Navegador' : navigator.userAgent.slice(0, 120);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const handleAuthExpired = () => setUser(null);

    window.addEventListener('sgp:auth-expired', handleAuthExpired);

    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      clearAuthSession();
      setIsLoading(false);

      return () => {
        cancelled = true;
        window.removeEventListener('sgp:auth-expired', handleAuthExpired);
      };
    }

    apiRequest('/auth/refresh', {
      method: 'POST',
      body: { refreshToken, device: deviceName() },
    })
      .then((session) => {
        if (cancelled) return;

        saveAuthSession(session);
        setUser(session.user);
      })
      .catch(() => {
        if (!cancelled) {
          clearAuthSession();
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      window.removeEventListener('sgp:auth-expired', handleAuthExpired);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    let checking = false;

    const checkSession = async () => {
      if (checking) return;

      checking = true;

      try {
        await apiRequest('/auth/session');
      } catch (error) {
        if (error.status === 401) {
          clearAuthSession();
          setUser(null);
        }
      } finally {
        checking = false;
      }
    };

    const interval = window.setInterval(checkSession, 5000);

    return () => window.clearInterval(interval);
  }, [user]);

  const login = useCallback(async (email, password) => {
    const session = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password, device: deviceName() },
    });

    saveAuthSession(session);
    setUser(session.user);
    return session.user;
  }, []);

  const register = useCallback(async (email, password) => {
    const session = await apiRequest('/auth/register', {
      method: 'POST',
      body: { email, password, device: deviceName() },
    });

    saveAuthSession(session);
    setUser(session.user);
    return session.user;
  }, []);

  const bootstrapAdministrator = useCallback(async ({ name, email, password }) => {
    const session = await apiRequest('/auth/bootstrap-admin', {
      method: 'POST',
      body: { name, email, password, device: deviceName() },
    });

    saveAuthSession(session);
    setUser(session.user);
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    let refreshToken = getRefreshToken();

    try {
      if (refreshToken) {
        const session = await apiRequest('/auth/refresh', {
          method: 'POST',
          body: { refreshToken, device: deviceName() },
        });

        saveAuthSession(session);
        refreshToken = session.refreshToken;

        await apiRequest('/auth/logout', {
          method: 'POST',
          body: { refreshToken },
        });
      }
    } finally {
      clearAuthSession();
      setUser(null);
    }
  }, []);

  const logoutAllDevices = useCallback(async () => {
    try {
      await apiRequest('/auth/logout-all', {
        method: 'POST',
      });
    } finally {
      clearAuthSession();
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    login,
    register,
    bootstrapAdministrator,
    logout,
    logoutAllDevices,
  }), [
    user,
    isLoading,
    login,
    register,
    bootstrapAdministrator,
    logout,
    logoutAllDevices,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) throw new Error('useAuth must be used within AuthProvider');

  return ctx;
}
