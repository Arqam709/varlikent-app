import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError } from '@/services/api-client';
import type { SafeUser } from '@/types/user';
import * as authApi from './auth-api';
import { sanitizeUser } from './sanitize-user';
import { getToken, removeToken, saveToken } from './token-storage';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  user: SafeUser | null;
  token: string | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      let storedToken: string | null = null;
      try {
        storedToken = await getToken();
      } catch {
        // A storage read failure is not proof of anything about the session.
        storedToken = null;
      }

      if (cancelled) return;

      if (!storedToken) {
        setStatus('unauthenticated');
        return;
      }

      try {
        const response = await authApi.getMe(storedToken);
        if (cancelled) return;

        setUser(sanitizeUser(response.user));
        setToken(storedToken);
        setStatus('authenticated');
      } catch (error) {
        if (cancelled) return


        if (error instanceof ApiError && error.kind === 'auth') {
          await removeToken().catch(() => {});
          setUser(null);
          setToken(null);
        }
        setStatus('unauthenticated');
      }
    };

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Shared tail of login and register — both receive { token, user }. */
  const applySession = useCallback(async (newToken: string, rawUser: unknown) => {
    const safeUser = sanitizeUser(rawUser);
    await saveToken(newToken);
    setUser(safeUser);
    setToken(newToken);
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await authApi.login(email, password);
      await applySession(response.token, response.user);
    },
    [applySession]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const response = await authApi.register(name, email, password);
      await applySession(response.token, response.user);
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    await removeToken().catch(() => {});
    setUser(null);
    setToken(null);
    setStatus('unauthenticated');
  }, []);

  // useMemo keeps the context value referentially stable, so consumers do not
  // re-render on every provider render.
  const value = useMemo<AuthContextValue>(
    () => ({ user, token, status, login, register, logout }),
    [user, token, status, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Reads the auth state. Throws if used outside AuthProvider. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
