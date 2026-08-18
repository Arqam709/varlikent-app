import { Cinzel_400Regular } from '@expo-google-fonts/cinzel/400Regular';
import { Cinzel_600SemiBold } from '@expo-google-fonts/cinzel/600SemiBold';
import { Cinzel_700Bold } from '@expo-google-fonts/cinzel/700Bold';
import { JosefinSans_400Regular } from '@expo-google-fonts/josefin-sans/400Regular';
import { JosefinSans_500Medium } from '@expo-google-fonts/josefin-sans/500Medium';
import { JosefinSans_600SemiBold } from '@expo-google-fonts/josefin-sans/600SemiBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';

import BrandSplash from '@/components/brand-splash';
import { AuthProvider } from '@/features/auth/auth-context';
import { LanguageProvider } from '@/features/localization/language-context';
import { RealtimeProvider } from '@/features/realtime/realtime-context';
import { ThemeProvider, useTheme } from '@/features/theme/theme-context';

/**
 * ROOT LAYOUT
 *
 * Expo Router renders this around EVERY screen, so it is the one place
 * guaranteed to run before any screen appears. Its job is to COORDINATE
 * startup: load fonts, provide auth state, and hand off from the native splash
 * to our branded one. The splash's own visuals and timing belong to
 * BrandSplash; the session logic belongs to AuthProvider.
 *
 * ── Startup order ────────────────────────────────────────────────────────
 *   1. Module loads → preventAutoHideAsync() pins the native splash
 *   2. useFonts registers the six Varlikent weights
 *   3. Fonts not ready → render null (native splash still covering)
 *   4. Fonts ready → render Stack + BrandSplash overlay + AuthProvider.
 *      AuthProvider mounts HERE and immediately starts reading SecureStore
 *      and, if a token exists, calling GET /auth/me.
 *   5. Effect fires → native splash hides, revealing BrandSplash
 *   6. BrandSplash animates (~1.05s) — the session check runs concurrently
 *      underneath, so restoring a session costs no extra waiting time
 *   7. BrandSplash reports finished → unmounts → app visible
 *
 * Why no flash of "signed out": AuthProvider starts at status 'loading', not
 * 'unauthenticated'. Screens branch on that third state rather than assuming
 * a logged-out user, so nothing ever renders a signed-out UI it has to take
 * back. In practice the ~1.05s splash usually outlasts the /auth/me round
 * trip, so the app is already resolved by the time anything is visible.
 */

/**
 * Hold the OS-drawn splash (configured in app.json) until we say otherwise.
 * Runs at MODULE scope — as the file is imported, before React renders — so
 * it beats the default behaviour of hiding on first paint.
 */
SplashScreen.preventAutoHideAsync();

/**
 * Marks `(tabs)` as the root Stack's anchor — the route that is always
 * considered to sit underneath.
 *
 * It matters when a screen outside the tabs is opened without history, e.g.
 * deep-linking straight to /login: the anchor guarantees there is a tab screen
 * beneath it to go back to, instead of back exiting the app.
 */
export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * Status-bar icon colour, driven by the active palette.
 *
 * Split into its own component because `useTheme()` can only be called BELOW
 * ThemeProvider, and RootLayout is what renders the provider.
 */
function ThemedStatusBar() {
  const { isDark } = useTheme();
  // 'light' = light icons, for a dark bar. Only Dark Luxury is a dark palette;
  // the other four take dark icons on their light grounds.
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  /**
   * Register the six approved weights with the native text engine.
   *
   * The KEYS of this map become the strings you may later pass to
   * `fontFamily`. Because each imported constant is already named exactly
   * `Cinzel_700Bold` etc., JavaScript's shorthand property syntax gives us
   * keys identical to those names for free — which is exactly what the
   * `FontFamily` constants in constants/theme.ts expect.
   *
   * The values are not the font names; they are numeric module handles
   * produced by the bundler when it packages each .ttf file.
   */
  const [loaded, error] = useFonts({
    Cinzel_400Regular,
    Cinzel_600SemiBold,
    Cinzel_700Bold,
    JosefinSans_400Regular,
    JosefinSans_500Medium,
    JosefinSans_600SemiBold,
  });

  /**
   * STARTUP STATE
   *
   * One boolean drives the whole handoff: has the branded splash finished?
   * It starts false, so the overlay is present on the very first render that
   * has content, and flips once — there is no path back to true.
   */
  const [splashFinished, setSplashFinished] = useState(false);

  /**
   * The callback we hand down to BrandSplash. `useCallback` keeps its identity
   * stable across renders, so the child never sees a "new" function.
   */
  const handleSplashFinish = useCallback(() => setSplashFinished(true), []);

  useEffect(() => {
    // Hide the NATIVE splash once fonts are registered — OR if loading failed,
    // so a font problem can never leave the app stuck behind it forever.
    //
    // Timing detail that makes the handoff seamless: React commits and paints
    // the render below BEFORE effects run. So by the time this line executes,
    // BrandSplash is already on screen and the native splash uncovers our
    // splash rather than a blank frame.
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  /**
   * Render nothing while loading. The native splash is still covering the
   * screen, so there is nothing to show and a spinner would only flash.
   *
   * Note the `&& !error`: if we gated on `!loaded` alone and a font failed,
   * `loaded` would never become true and the app would hang on the splash.
   * On error we continue and let text fall back to the system font — degraded
   * typography is far better than a frozen app.
   */
  if (!loaded && !error) {
    return null;
  }

  return (
    /*
      The providers wrap the navigator so every screen can use them. They sit
      INSIDE the font gate, so they only mount once the app is really starting
      up — and outside BrandSplash, so session restore and preference reads run
      while the animation plays instead of after it. That is also what keeps
      startup flash-free: by the time the splash fades, language and theme have
      already resolved from AsyncStorage.

      PROVIDER ORDER — chosen deliberately, outermost first:

        LanguageProvider   depends on nothing. Reads AsyncStorage only, so it can
                           sit outermost and have translations ready before any
                           screen renders.
        AuthProvider       depends on nothing. Owns the session.
        ThemeProvider      depends on AUTH — it falls back to the account's
                           themePreference when this device has no stored choice,
                           so it must be able to call useAuth().
        RealtimeProvider   depends on AUTH — needs the JWT to open its socket.

      Theme and Realtime are siblings under Auth because neither needs the other;
      keeping them independent means a socket problem cannot affect theming, and
      a theme write cannot disturb the socket. Crucially, AuthProvider's position
      is UNCHANGED relative to RealtimeProvider, so RT-0's connect-on-token and
      RT-3's AppState recovery initialise exactly as before.
    */
    <LanguageProvider>
      <AuthProvider>
        <ThemeProvider>
          <RealtimeProvider>
        {/*
          `headerShown: false` in screenOptions applies to EVERY screen in this
          Stack — that is what removes the default "index" title bar. We turn it
          off globally because Varlikent will have its own custom header and
          bottom tabs; a screen that wants a native header can opt back in.
        */}
        <Stack screenOptions={{ headerShown: false }} />

        {/*
          The splash is rendered AFTER <Stack>, so it sits on top. The app mounts
          and lays out underneath while the animation plays, meaning the fade-out
          reveals a screen that is already rendered — no blank frame, no second
          loading beat.

          Once BrandSplash reports completion this whole element is removed from
          the tree, so it costs nothing for the rest of the session.
        */}
        {!splashFinished && <BrandSplash onFinish={handleSplashFinish} />}

            {/*
              Status-bar icons follow the ACTIVE THEME, not the OS setting.
              `'auto'` asks the system, which knows nothing about the palette we
              painted — so Dark Luxury on a light-mode phone got dark icons on a
              near-black bar, and vice versa. ThemedStatusBar reads `isDark` from
              the theme instead. The splash keeps its fixed light icons because
              its ground is near-black regardless of theme.
            */}
            {splashFinished ? <ThemedStatusBar /> : <StatusBar style="light" />}
          </RealtimeProvider>
        </ThemeProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
