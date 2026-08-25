import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/auth-context';
import { readStoredTheme, writeStoredTheme } from '@/features/preferences/preferences-storage';
import { updateThemePreference } from '@/features/account/account-api';
import { fromSharedThemeId, toSharedThemeId } from './theme-contract';
import { THEMES, THEME_META, toThemeId, type ThemeId, type ThemePalette } from './themes';

/**
 * The active Varlikent theme.
 *
 * ── Persistence: device-local, mirrored to the account ──────────────────
 * The website reads `localStorage.getItem('vk_theme')` for its initial value,
 * and on change writes BOTH localStorage and `PUT /api/users/me/theme`
 * (→ `User.themePreference`).
 *
 * It ALSO reads that field back: `ThemeContext.jsx` applies
 * `user.themePreference` once per signed-in user and overwrites its own
 * localStorage with it. The field is therefore authoritative on the website at
 * login, and a value written from a phone really does reach the browser.
 *
 * Mobile's own precedence:
 *   • AsyncStorage is authoritative for THIS DEVICE, and is read first so the
 *     app opens in the right theme with no flash.
 *   • `PUT /users/me/theme` is called on change, so the account record stays
 *     consistent with what the customer chose.
 *   • `user.themePreference` is used only as a FALLBACK, when this device has no
 *     stored choice yet — so a returning customer's account preference greets
 *     them on a fresh install, without a phone silently overriding a deliberate
 *     choice made on this device.
 *
 * ── The two vocabularies ────────────────────────────────────────────────
 * Mobile's local ids are NOT what the server stores. The backend validates
 * against eight canonical website ids and rejects anything else with a 400 —
 * which is exactly what used to happen to `classic`, `dark` and `light` on
 * every single sync, invisibly, because the failure is swallowed by design.
 *
 * Every crossing of that boundary now goes through theme-contract.ts, and a
 * theme with no honest shared equivalent (Dark Luxury) is simply not synced
 * rather than being reported to the account as something it is not.
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

    /*
     * The stored value speaks the CANONICAL vocabulary, so it is translated
     * rather than merely validated. `null` means this build has no palette for
     * the customer's account theme (one of the six not yet ported) — the
     * current theme is then deliberately left alone and nothing is written to
     * storage, so their real preference survives on the server untouched until
     * Phase 10F can honour it.
     */
    const fromAccount = fromSharedThemeId(user.themePreference);
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
       *
       * `shared` is null for a mobile-only theme, and then NO request is made at
       * all. That is the intended outcome rather than a skipped error path: the
       * previous account preference is left standing, which is more honest than
       * overwriting it with a palette the customer is not looking at.
       */
      const shared = toSharedThemeId(next);

      if (token && shared) {
        updateThemePreference(token, shared).catch(() => {});
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
