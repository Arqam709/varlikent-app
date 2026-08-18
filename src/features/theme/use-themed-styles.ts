import { useMemo } from 'react';

import { useTheme } from './theme-context';
import type { ThemePalette } from './themes';

/**
 * Builds a screen's StyleSheet from the ACTIVE theme.
 *
 * ── The bug this exists to fix ──────────────────────────────────────────
 * `StyleSheet.create({...})` at module scope is evaluated ONCE, when the file
 * is first imported. A sheet written as `backgroundColor: Colors.softWhite`
 * therefore captures the Signature palette permanently — changing the theme
 * later cannot affect it, because nothing re-runs. That is precisely why the
 * theme visibly worked on the Account screens (which read `useTheme()` inline)
 * and nowhere else.
 *
 * ── The migration this enables ──────────────────────────────────────────
 * Converting a screen becomes mechanical and low-risk:
 *
 *     const styles = StyleSheet.create({ safe: { backgroundColor: Colors.softWhite } })
 *     →
 *     const makeStyles = (theme: ThemePalette) =>
 *       StyleSheet.create({ safe: { backgroundColor: theme.background } })
 *
 *     ...and inside the component:
 *     const styles = useThemedStyles(makeStyles)
 *
 * The style objects keep their existing names and shapes, so JSX does not
 * change at all. Layout values (Spacing, Radius, FontSizes, FontFamily) stay
 * imported statically from constants/theme — they do not vary by theme and
 * putting them here would be a third colour architecture, which is exactly what
 * we are avoiding.
 *
 * ── Why memoised on the palette object ──────────────────────────────────
 * `theme` is a stable reference from ThemeProvider's useMemo, changing only
 * when the theme actually changes. So the sheet is rebuilt once per theme
 * switch rather than on every render — a plain call to `makeStyles(theme)` in
 * the render body would allocate a fresh StyleSheet on every keystroke in a
 * form.
 *
 * `factory` must be declared at module scope (a stable reference). A factory
 * defined inline inside the component would change identity every render and
 * defeat the memo.
 */
export function useThemedStyles<T>(factory: (theme: ThemePalette) => T): T {
  const { theme } = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
