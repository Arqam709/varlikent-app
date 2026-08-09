/**
 * Design tokens for the Varlikent mobile app.
 *
 * React Native has no CSS, no stylesheets, no CSS variables and no cascade.
 * Every style is a plain JavaScript object attached to a single component.
 * That means there is nothing like `:root { --color-primary: ... }` — if we
 * want shared values, we export them from a file and import them.
 *
 * This file is that file. It is the mobile equivalent of your CSS variables
 * or Tailwind theme config on the website.
 */

/**
 * Brand palette.
 *
 * TODO: replace these with the real Varlikent website colors.
 * They are deliberately neutral placeholders for now.
 */
const brand = {
  primary: '#0F5132',
  primaryDark: '#0A3D26',
  primaryLight: '#E8F3EE',
};

/**
 * Two complete color sets: one for light mode, one for dark mode.
 *
 * The user object from the backend has a `themePreference` field, so the
 * website already has this concept. We are only defining the values here —
 * actually reading the preference comes much later.
 */
export const Colors = {
  light: {
    background: '#FFFFFF',
    surface: '#F7F8FA',
    text: '#11181C',
    textMuted: '#687076',
    border: '#E1E4E8',
    primary: brand.primary,
    primaryText: '#FFFFFF',
    danger: '#D32F2F',
    success: '#2E7D32',
  },
  dark: {
    background: '#151718',
    surface: '#1F2223',
    text: '#ECEDEE',
    textMuted: '#9BA1A6',
    border: '#2C2F31',
    primary: '#3FA96F',
    primaryText: '#08130C',
    danger: '#EF5350',
    success: '#66BB6A',
  },
};

/**
 * Spacing scale, in density-independent pixels.
 *
 * React Native numbers are unitless — `padding: 16` means 16dp, and the OS
 * scales it for the device's screen density. There is no `px`, `rem` or `em`.
 */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

/** Corner radii, so buttons/inputs/cards stay visually consistent. */
export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
};

/** Type scale. `fontWeight` must be a string in React Native, not a number. */
export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
};

/** Convenience type: 'light' | 'dark'. Used wherever we pass a scheme around. */
export type ColorScheme = keyof typeof Colors;

/** Convenience type: the shape of one complete color set. */
export type ThemeColors = (typeof Colors)[ColorScheme];
