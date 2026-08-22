import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError } from '@/services/api-client';
import type { SafeUser } from '@/types/user';
import * as authApi from './auth-api';
import { signInWithGoogleNative } from './google-signin';
import { sanitizeUser } from './sanitize-user';
import { getToken, removeToken, saveToken } from './token-storage';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * What a Google sign-in attempt did.
 *
 * 'cancelled' is a first-class outcome rather than an error: backing out of the
 * account sheet is a normal thing to do, and it must not surface as a failure
 * banner. Callers navigate on 'signed-in' and do nothing at all on 'cancelled'.
 */
export type GoogleLoginOutcome = 'signed-in' | 'cancelled';

type AuthContextValue = {
  user: SafeUser | null;
  token: string | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  /**
   * Signs in with Google and adopts the resulting Varlikent session.
   *
   * Serves both Login and Register: Google authentication has no separate
   * sign-up endpoint, because the backend's resolveGoogleUser() already finds,
   * links or creates as appropriate. The user should never have to know which
   * of those happened.
   *
   * Resolves 'cancelled' when the user dismisses the account sheet — no error,
   * no request, no state change. Throws ApiError for backend rejections and
   * GoogleSignInFailure for native/configuration problems.
   */
  loginWithGoogle: () => Promise<GoogleLoginOutcome>;
  logout: () => Promise<void>;
  /**
   * Replaces the signed-in user with a fresh copy returned by the server.
   *
   * Used by the account screens after a successful profile, avatar or theme
   * write — those endpoints all return the updated user, so the app can adopt it
   * without a second /auth/me round trip. The payload still goes through
   * `sanitizeUser`, so a server response is never trusted into state wholesale.
   *
   * Only the user is touched; the token is untouched, because none of these
   * writes issue a new one.
   */
  applyUser: (rawUser: unknown) => void;
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

  const loginWithGoogle = useCallback(async (): Promise<GoogleLoginOutcome> => {
    const result = await signInWithGoogleNative();

    if (result.type === 'cancelled') {
      return 'cancelled';
    }

    /**
     * The Google token's entire life is this one statement. It is passed to the
     * backend, exchanged for a Varlikent JWT, and then goes out of scope — never
     * stored, never held in state, never logged. Everything after this point is
     * identical to an email/password sign-in.
     */
    const response = await authApi.googleLogin(result.idToken);
    await applySession(response.token, response.user);

    return 'signed-in';
  }, [applySession]);

  const logout = useCallback(async () => {
    await removeToken().catch(() => {});
    setUser(null);
    setToken(null);
    setStatus('unauthenticated');
  }, []);

  const applyUser = useCallback((rawUser: unknown) => {
    try {
      setUser(sanitizeUser(rawUser));
    } catch {
      // An unusable payload leaves the existing user in place. A successful
      // profile save must not be able to sign someone out.
    }
  }, []);

  // useMemo keeps the context value referentially stable, so consumers do not
  // re-render on every provider render.
  const value = useMemo<AuthContextValue>(
    () => ({ user, token, status, login, register, loginWithGoogle, logout, applyUser }),
    [user, token, status, login, register, loginWithGoogle, logout, applyUser]
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
