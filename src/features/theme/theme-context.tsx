import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/auth-context';
import { readStoredTheme, writeStoredTheme } from '@/features/preferences/preferences-storage';
import { updateThemePreference } from '@/features/account/account-api';
import { THEMES, THEME_META, toThemeId, type ThemeId, type ThemePalette } from './themes';

/**
 * The active Varlikent theme.
 *
 * ── Persistence: device-local, mirrored to the account ──────────────────
 * This is the same two-place strategy the website uses, and it was chosen after
 * reading how the website actually behaves:
 *
 *   ThemeContext.jsx reads `localStorage.getItem('vk_theme')` for its initial
 *   value, and on change writes BOTH localStorage and
 *   `PUT /api/users/me/theme` (→ `User.themePreference`).
 *
 * Notably the website WRITES `themePreference` but never reads it back — its
 * initial value comes from localStorage only. So the server field exists and is
 * kept current, but nothing yet treats it as authoritative.
 *
 * Mobile mirrors that exactly:
 *   • AsyncStorage is authoritative for THIS DEVICE, and is read first so the
 *     app opens in the right theme with no flash.
 *   • `PUT /users/me/theme` is still called, so the account record stays
 *     consistent with what the customer chose and the field does not rot.
 *   • `user.themePreference` is used only as a FALLBACK, when this device has no
 *     stored choice yet — so a returning customer's account preference greets
 *     them on a fresh install, without a phone silently overriding a deliberate
 *     choice made on this device.
 *
 * ── Does changing the theme on mobile change it on the website? ──────────
 * Not today, because the website never reads the field. If it is ever changed
 * to read `themePreference`, the two would converge automatically — which is
 * the behaviour the field name implies. Deliberately no schema change here.
 */

type ThemeContextValue = {
  themeId: ThemeId;
  theme: ThemePalette;
  isDark: boolean;
  setTheme: (next: ThemeId) => Promise<void>;
  /** False until the stored preference has been read. */
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();

  const [themeId, setThemeId] = useState<ThemeId>('default');
  const [ready, setReady] = useState(false);

  /**
   * Whether this device has an explicit stored choice.
   *
   * Guards the account fallback below: without it, signing in would overwrite a
   * theme the customer had just picked on this phone.
   */
  const hasDeviceChoiceRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    readStoredTheme().then((stored) => {
      if (cancelled) return;

      const id = toThemeId(stored);
      if (id) {
        hasDeviceChoiceRef.current = true;
        setThemeId(id);
      }

      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Adopt the account's preference only when this device has never chosen.
   *
   * Runs after `ready` so it cannot race the AsyncStorage read and win, which
   * would be the bug: the account value would briefly replace the device value
   * on every launch.
   */
  useEffect(() => {
    if (!ready || hasDeviceChoiceRef.current || !user) return;

    const fromAccount = toThemeId(user.themePreference);
    if (fromAccount) setThemeId(fromAccount);
  }, [ready, user]);

  const setTheme = useCallback(
    async (next: ThemeId) => {
      hasDeviceChoiceRef.current = true;
      setThemeId(next);

      // Device first: this is what makes the choice survive a restart, and it
      // must not depend on the network.
      await writeStoredTheme(next);

      /*
       * Then mirror to the account, best effort.
       *
       * Deliberately not awaited into the UI and errors are swallowed: the theme
       * has already changed on screen and been saved locally, so a failed sync
       * (offline, Render asleep) must not surface an error for an action that
       * visibly succeeded.
       */
      if (token) {
        updateThemePreference(token, next).catch(() => {});
      }
    },
    [token]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      theme: THEMES[themeId],
      isDark: THEME_META[themeId].isDark,
      setTheme,
      ready,
    }),
    [themeId, setTheme, ready]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Reads the active theme.
 *
 * Throws outside the provider: a screen styling itself from an absent palette
 * would render invisible text, and that is far better caught in development.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
